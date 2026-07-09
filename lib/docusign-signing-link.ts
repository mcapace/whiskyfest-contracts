import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrlForProduct, type EventEmailContext } from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';

function signingLinkSecret(): string {
  const secret =
    process.env['DOCUSIGN_SIGN_LINK_SECRET']?.trim() ||
    process.env['AUTH_SECRET']?.trim() ||
    process.env['NEXTAUTH_SECRET']?.trim() ||
    '';
  if (!secret) {
    throw new Error(
      'DOCUSIGN_SIGN_LINK_SECRET or AUTH_SECRET must be set for personal-note signing links.',
    );
  }
  return secret;
}

/** HMAC token so only the intended signer can open the DocuSign redirect. */
export function createDocuSignSigningLinkToken(contractId: string, signerEmail: string): string {
  const payload = `${contractId}:${signerEmail.trim().toLowerCase()}`;
  return createHmac('sha256', signingLinkSecret()).update(payload).digest('base64url');
}

export function verifyDocuSignSigningLinkToken(
  contractId: string,
  signerEmail: string,
  token: string,
): boolean {
  const expected = createDocuSignSigningLinkToken(contractId, signerEmail);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function docuSignSigningRedirectUrl(
  contractId: string,
  event: EventEmailContext | null | undefined,
  signerEmail: string,
): string {
  const productKey = productKeyFromEvent(event);
  
  if (!event?.product_key) {
    console.error('[docuSignSigningRedirectUrl] Event missing product_key - defaulting to whiskyfest', {
      contractId,
      event: event ? { name: event.name, product_key: event.product_key } : null,
      resolved_product_key: productKey,
    });
  }
  
  const token = createDocuSignSigningLinkToken(contractId, signerEmail);
  const base = appBaseUrlForProduct(productKey);
  
  console.log('[docuSignSigningRedirectUrl] Generated signing URL', {
    contractId,
    product_key: productKey,
    event_name: event?.name,
    base_url: base,
  });
  
  return `${base}/api/contracts/${encodeURIComponent(contractId)}/docusign-sign?t=${encodeURIComponent(token)}`;
}
