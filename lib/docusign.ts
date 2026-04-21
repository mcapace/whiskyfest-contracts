import jwt from 'jsonwebtoken';
import { DOCUSIGN_ANCHORS } from '@/lib/merge-map';

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function getPrivateKeyPem(): string {
  const b64 = process.env['DOCUSIGN_RSA_PRIVATE_KEY']?.trim();
  if (!b64) throw new Error('Missing DOCUSIGN_RSA_PRIVATE_KEY env var');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function authHostFromUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function restBase(): string {
  const base = process.env['DOCUSIGN_BASE_URL'] ?? 'https://demo.docusign.net/restapi';
  return base.replace(/\/$/, '');
}

/**
 * JWT Grant — same claims as the official DocuSign Node SDK.
 * Implemented with fetch so we avoid bundling `docusign-esign` (incompatible with Next.js webpack).
 */
export async function getAccessToken(): Promise<string> {
  const integrationKey = requireEnv('DOCUSIGN_INTEGRATION_KEY');
  const userId = requireEnv('DOCUSIGN_USER_ID');
  const authUrl = process.env['DOCUSIGN_AUTH_URL'] ?? 'https://account-d.docusign.com';
  const oAuthBasePath = authHostFromUrl(authUrl);
  const privateKey = getPrivateKeyPem();

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: integrationKey,
      sub: userId,
      aud: oAuthBasePath,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    },
    privateKey,
    { algorithm: 'RS256' },
  );

  const tokenUrl = `https://${oAuthBasePath}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSign OAuth ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { access_token?: string };
  if (!data.access_token) throw new Error('DocuSign OAuth: no access_token');
  return data.access_token;
}

function anchorOnly(anchor: string) {
  return {
    anchorString: anchor,
    anchorUnits: 'pixels',
    anchorXOffset: '0',
    anchorYOffset: '0',
  };
}

export interface SendEnvelopeParams {
  pdfBase64: string;
  documentName: string;
  emailSubject: string;
  emailBlurb: string;
  signer1: { email: string; name: string };
  signer2: { email: string; name: string };
}

/** When true, both signers receive DocuSign invite emails immediately (routing order 1 for both). */
export function isDocuSignParallelSigners(): boolean {
  const v = process.env['DOCUSIGN_PARALLEL_SIGNERS']?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export async function sendEnvelope(params: SendEnvelopeParams): Promise<{ envelopeId: string }> {
  const accountId = requireEnv('DOCUSIGN_ACCOUNT_ID');
  const accessToken = await getAccessToken();

  const signHere1 = anchorOnly(DOCUSIGN_ANCHORS.sig1);
  const date1 = anchorOnly(DOCUSIGN_ANCHORS.date1);
  const signHere2 = anchorOnly(DOCUSIGN_ANCHORS.sig2);
  const date2 = anchorOnly(DOCUSIGN_ANCHORS.date2);

  /** Sequential (1→2): only signer 1 gets an email until they sign; signer 2 is queued. Parallel (both 1): both get “sign now” at send. */
  const parallel = isDocuSignParallelSigners();
  const order2 = parallel ? '1' : '2';

  const envelopeDefinition = {
    emailSubject: params.emailSubject,
    emailBlurb: params.emailBlurb,
    status: 'sent',
    documents: [
      {
        documentBase64: params.pdfBase64,
        name: params.documentName,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: params.signer1.email,
          name: params.signer1.name,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [signHere1],
            dateSignedTabs: [date1],
          },
        },
        {
          email: params.signer2.email,
          name: params.signer2.name,
          recipientId: '2',
          routingOrder: order2,
          tabs: {
            signHereTabs: [signHere2],
            dateSignedTabs: [date2],
          },
        },
      ],
    },
  };

  const url = `${restBase()}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ envelopeDefinition }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSign createEnvelope ${res.status}: ${text}`);
  }
  const summary = JSON.parse(text) as { envelopeId?: string };
  if (!summary.envelopeId) throw new Error('DocuSign createEnvelope: missing envelopeId');
  return { envelopeId: summary.envelopeId };
}

export async function downloadCompletedPdf(envelopeId: string): Promise<Buffer> {
  const accountId = requireEnv('DOCUSIGN_ACCOUNT_ID');
  const accessToken = await getAccessToken();

  const q = new URLSearchParams({ certificate: 'true' });
  const url = `${restBase()}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined?${q}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/pdf',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocuSign getDocument ${res.status}: ${errText}`);
  }

  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
