import jwt from 'jsonwebtoken';
import { buildExhibitorDataTextTabs } from '@/lib/exhibitor-docusign-fields';
import { DOCUSIGN_ANCHORS } from '@/lib/merge-map';
import { isWhiskyfestBigSmokeCountersignerEmail, WF_BS_COUNTERSIGN_GROUP_LABEL } from '@/lib/wf-bslv-countersigner';

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

/** REST API base URL (no trailing slash). Exported for diagnostics (e.g. envelope list). */
export function restBase(): string {
  const base = process.env['DOCUSIGN_BASE_URL'] ?? 'https://demo.docusign.net/restapi';
  return base.replace(/\/$/, '');
}

export function getDocuSignAccountId(): string {
  return requireEnv('DOCUSIGN_ACCOUNT_ID');
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

interface OAuthUserInfoAccount {
  account_id?: string;
  account_name?: string;
  is_default?: boolean;
  base_uri?: string;
}

function normalizeRestApiBase(baseUri: string): string {
  return `${baseUri.replace(/\/$/, '')}/restapi`;
}

async function resolveApiContext(accessToken: string): Promise<{ accountId: string; restApiBase: string }> {
  const envAccountId = process.env['DOCUSIGN_ACCOUNT_ID']?.trim();
  const envBase = process.env['DOCUSIGN_BASE_URL']?.trim();

  const authUrl = process.env['DOCUSIGN_AUTH_URL'] ?? 'https://account-d.docusign.com';
  const oAuthBasePath = authHostFromUrl(authUrl);

  const userInfoRes = await fetch(`https://${oAuthBasePath}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  if (!userInfoRes.ok) {
    const t = await userInfoRes.text();
    markDocuSignRateLimitedFromResponse(userInfoRes.status, t);
    if (envAccountId && envBase) {
      console.warn(`[DocuSign] userinfo lookup failed (${userInfoRes.status}); using env account/base fallback`);
      return { accountId: envAccountId, restApiBase: envBase.replace(/\/$/, '') };
    }
    throw new Error(`DocuSign userinfo ${userInfoRes.status}: ${t}`);
  }

  const payload = (await userInfoRes.json()) as { accounts?: OAuthUserInfoAccount[] };
  const accounts = payload.accounts ?? [];
  if (accounts.length === 0) {
    if (envAccountId && envBase) {
      console.warn('[DocuSign] userinfo returned no accounts; using env account/base fallback');
      return { accountId: envAccountId, restApiBase: envBase.replace(/\/$/, '') };
    }
    throw new Error('DocuSign userinfo returned no accounts');
  }

  const chosen =
    (envAccountId
      ? accounts.find((a) => (a.account_id ?? '').trim() === envAccountId)
      : undefined) ??
    accounts.find((a) => a.is_default) ??
    accounts[0];

  if (!chosen?.account_id) {
    throw new Error('DocuSign userinfo did not provide account_id');
  }

  if (envAccountId && chosen.account_id !== envAccountId) {
    const available = accounts.map((a) => a.account_id).filter(Boolean).join(', ');
    throw new Error(`DOCUSIGN_ACCOUNT_ID not found in token userinfo. Configured=${envAccountId}; available=${available}`);
  }

  const accountId = envAccountId ?? chosen.account_id;
  // Account-scoped base_uri from userinfo — DOCUSIGN_BASE_URL alone is often the wrong cluster.
  const restApiBase = normalizeRestApiBase(chosen.base_uri ?? '') || envBase?.replace(/\/$/, '');
  if (!restApiBase) throw new Error('DocuSign userinfo did not provide base_uri and DOCUSIGN_BASE_URL is not set');

  return { accountId, restApiBase };
}

export type DocuSignSession = {
  accessToken: string;
  accountId: string;
  restApiBase: string;
};

let cachedSession: { session: DocuSignSession; expiresAt: number } | null = null;
const SESSION_REFRESH_MS = 50 * 60 * 1000;

/** Drop cached token/context — e.g. after USER_AUTHENTICATION_FAILED on REST calls. */
export function clearDocuSignSessionCache(): void {
  cachedSession = null;
}

/** Reuse OAuth token + account context — avoids repeat userinfo calls within the same session window. */
export async function getDocuSignSession(): Promise<DocuSignSession> {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.session;
  }

  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);
  const session = { accessToken, accountId, restApiBase };
  cachedSession = { session, expiresAt: now + SESSION_REFRESH_MS };
  return session;
}

export function isDocuSignAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('USER_AUTHENTICATION_FAILED') || msg.includes('AUTHORIZATION_INVALID_TOKEN');
}

export function isDocuSignRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('HOURLY_APIINVOCATION_LIMIT_EXCEEDED') ||
    msg.includes('API_INVOCATION_LIMIT') ||
    msg.includes('BURST_APIINVOCATION_LIMIT_EXCEEDED')
  );
}

let docuSignRateLimitedUntilMs = 0;

function maybeAssertDocuSignApiAvailable(bypass?: boolean): void {
  if (!bypass) assertDocuSignApiAvailable();
}

export function isDocuSignRateLimitedNow(): boolean {
  return Date.now() < docuSignRateLimitedUntilMs;
}

export function markDocuSignRateLimitedFromResponse(status: number, body: string): void {
  if (
    status === 429 ||
    body.includes('HOURLY_APIINVOCATION_LIMIT_EXCEEDED') ||
    body.includes('BURST_APIINVOCATION_LIMIT_EXCEEDED') ||
    body.includes('API_INVOCATION_LIMIT')
  ) {
    docuSignRateLimitedUntilMs = Date.now() + 55 * 60 * 1000;
  }
}

export function assertDocuSignApiAvailable(): void {
  if (isDocuSignRateLimitedNow()) {
    throw new Error(
      'DocuSign hourly API limit reached (3,000 calls/hour). Wait about an hour for the limit to reset, then try again.',
    );
  }
}

export function isDocuSignBackgroundSyncDisabled(): boolean {
  const v = process.env['DOCUSIGN_BACKGROUND_SYNC_DISABLED']?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function formatDocuSignErrorForUser(err: unknown): string {
  if (isDocuSignRateLimitError(err)) {
    return 'DocuSign is temporarily busy (hourly API limit). Please check your inbox for an email from DocuSign with the subject line about signing your agreement — you can sign directly from that email without using this link. If you do not see it, contact your Shanken representative and ask them to resend the DocuSign envelope.';
  }
  if (isDocuSignAuthError(err)) {
    return 'DocuSign authentication failed. Confirm production env vars (DOCUSIGN_AUTH_URL, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID) match your live account, JWT consent is granted, and DOCUSIGN_BASE_URL is not pointing at the demo cluster. Then try again.';
  }
  return err instanceof Error ? err.message : String(err);
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
  /** Event-level Shanken countersigner recipient (routing order 2). */
  countersigner?: { email: string; name: string } | null;
  /** Shared signing group — any member may countersign (WhiskyFest / Big Smoke). */
  countersignerSigningGroupId?: string | null;
  /** Optional carbon copy — receives DocuSign notifications but does not sign. */
  carbonCopy?: { email: string; name: string } | null;
  /** DocuSign brand id — controls exhibitor-facing signing email sender/branding. */
  brandId?: string;
  /**
   * Reply-To on DocuSign signing emails (From still follows the DocuSign user/brand).
   * Use product SendGrid identity so NYWE / Big Smoke / WhiskyFest replies go to the right inbox.
   */
  replyTo?: { email: string; name: string } | null;
  /** NYWE licenses with roster billing merged into PDF — skip empty exhibitor fill tabs. */
  skipExhibitorDataTabs?: boolean;
  /**
   * Where routing-order-1 Sign/Date tabs anchor.
   * Use `countersigner` when the exhibitor already signed on an uploaded PDF and only
   * Shanken needs to countersign (single-recipient envelope on \\s2\\ / \\d2\\).
   */
  signer1TabAnchors?: 'exhibitor' | 'countersigner';
}

export async function sendEnvelope(params: SendEnvelopeParams): Promise<{ envelopeId: string }> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();

  const useCountersignerAnchors = params.signer1TabAnchors === 'countersigner';
  const signHere1 = anchorOnly(useCountersignerAnchors ? DOCUSIGN_ANCHORS.sig2 : DOCUSIGN_ANCHORS.sig1);
  const date1 = anchorOnly(useCountersignerAnchors ? DOCUSIGN_ANCHORS.date2 : DOCUSIGN_ANCHORS.date1);
  const exhibitorTabs =
    params.skipExhibitorDataTabs || useCountersignerAnchors ? {} : buildExhibitorDataTextTabs();

  const signers: Record<string, unknown>[] = [
    {
      email: params.signer1.email,
      name: params.signer1.name,
      recipientId: '1',
      routingOrder: '1',
      ...(useCountersignerAnchors ? { roleName: 'Countersigner' } : {}),
      tabs: {
        signHereTabs: [signHere1],
        dateSignedTabs: [date1],
        ...exhibitorTabs,
      },
    },
  ];

  const countersigner = params.countersigner;
  const signingGroupId = params.countersignerSigningGroupId?.trim();
  if (useCountersignerAnchors) {
    // Exhibitor signature already on the PDF — do not add a second recipient.
  } else if (signingGroupId) {
    const signHere2 = anchorOnly(DOCUSIGN_ANCHORS.sig2);
    const date2 = anchorOnly(DOCUSIGN_ANCHORS.date2);
    signers.push({
      signingGroupId,
      name: WF_BS_COUNTERSIGN_GROUP_LABEL,
      recipientId: '2',
      routingOrder: '2',
      roleName: 'Countersigner',
      tabs: {
        signHereTabs: [signHere2],
        dateSignedTabs: [date2],
      },
    });
  } else if (countersigner?.email?.trim() && countersigner?.name?.trim()) {
    const signHere2 = anchorOnly(DOCUSIGN_ANCHORS.sig2);
    const date2 = anchorOnly(DOCUSIGN_ANCHORS.date2);
    signers.push({
      email: countersigner.email.trim(),
      name: countersigner.name.trim(),
      recipientId: '2',
      routingOrder: '2',
      roleName: 'Countersigner',
      tabs: {
        signHereTabs: [signHere2],
        dateSignedTabs: [date2],
      },
    });
  }

  const envelopeDefinition: Record<string, unknown> = {
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
      signers,
    },
  };

  const cc = params.carbonCopy?.email?.trim();
  if (cc) {
    const recipients = envelopeDefinition.recipients as Record<string, unknown>;
    recipients.carbonCopies = [
      {
        email: cc,
        name: params.carbonCopy!.name.trim() || cc.split('@')[0] || 'Assistant',
        recipientId: '3',
        routingOrder: '1',
      },
    ];
  }

  if (params.brandId?.trim()) {
    envelopeDefinition.brandId = params.brandId.trim();
  }

  const replyEmail = params.replyTo?.email?.trim();
  const replyName = params.replyTo?.name?.trim();
  if (replyEmail) {
    envelopeDefinition.emailSettings = {
      replyEmailAddressOverride: replyEmail,
      ...(replyName ? { replyEmailNameOverride: replyName } : {}),
    };
  }

  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(envelopeDefinition),
  });

  const text = await res.text();
  if (!res.ok) {
    if (text.includes('USER_AUTHENTICATION_FAILED') || text.includes('AUTHORIZATION_INVALID_TOKEN')) {
      clearDocuSignSessionCache();
    }
    throw new Error(`DocuSign createEnvelope ${res.status}: ${text}`);
  }
  const summary = JSON.parse(text) as { envelopeId?: string; status?: string };
  if (!summary.envelopeId) throw new Error('DocuSign createEnvelope: missing envelopeId');
  return { envelopeId: summary.envelopeId };
}

export interface DocuSignSignerRow {
  email?: string;
  name?: string;
  routingOrder?: string;
  status?: string;
  signedDateTime?: string;
  recipientId?: string;
}

export async function fetchRecipientSignHereTabCount(
  envelopeId: string,
  recipientId: string,
  options?: { bypassRateLimitGuard?: boolean },
): Promise<number> {
  maybeAssertDocuSignApiAvailable(options?.bypassRateLimitGuard);
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients/${encodeURIComponent(recipientId)}/tabs`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    markDocuSignRateLimitedFromResponse(res.status, text);
    throw new Error(`DocuSign getRecipientTabs ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { signHereTabs?: Record<string, unknown>[] };
  const tabs = data.signHereTabs ?? [];
  return tabs.filter((raw) => {
    const tab = raw as Record<string, unknown>;
    const page = tab['pageNumber'] ?? tab['PageNumber'];
    const status = String(tab['status'] ?? tab['Status'] ?? '').toLowerCase();
    if (status === 'voided') return false;
    return page != null && String(page) !== '' && String(page) !== '0';
  }).length;
}

/** Load envelope recipients (signers) for webhook / audit (actual countersigner identity after signing group completes). */
/** Text tab values for a recipient (e.g. exhibitor routing order 1) after signing. */
export async function fetchRecipientTextTabs(
  envelopeId: string,
  recipientId: string,
): Promise<{ tabLabel: string; value: string }[]> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients/${encodeURIComponent(recipientId)}/tabs`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSign getRecipientTabs ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { textTabs?: Record<string, unknown>[] };
  const textTabs = data.textTabs ?? [];
  return textTabs
    .map((t) => {
      const tabLabel = String(t['tabLabel'] ?? t['TabLabel'] ?? '').trim();
      const value = String(t['value'] ?? t['Value'] ?? '').trim();
      return { tabLabel, value };
    })
    .filter((x) => x.tabLabel.length > 0);
}

/** Current envelope status from DocuSign (e.g. sent, delivered, completed, voided). */
export async function fetchEnvelopeStatus(
  envelopeId: string,
  options?: { bypassRateLimitGuard?: boolean },
): Promise<{ status: string }> {
  maybeAssertDocuSignApiAvailable(options?.bypassRateLimitGuard);
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    markDocuSignRateLimitedFromResponse(res.status, text);
    throw new Error(`DocuSign getEnvelope ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { status?: string; Status?: string };
  const status = String(data.status ?? data.Status ?? '').trim();
  if (!status) throw new Error('DocuSign getEnvelope: missing status');
  return { status };
}

export async function fetchEnvelopeSigners(
  envelopeId: string,
  options?: { bypassRateLimitGuard?: boolean },
): Promise<DocuSignSignerRow[]> {
  maybeAssertDocuSignApiAvailable(options?.bypassRateLimitGuard);
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    markDocuSignRateLimitedFromResponse(res.status, text);
    throw new Error(`DocuSign getRecipients ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { signers?: Record<string, unknown>[] };
  const signers = data.signers ?? [];
  return signers.map((s) => ({
    email: typeof s['email'] === 'string' ? s['email'] : undefined,
    name: typeof s['name'] === 'string' ? s['name'] : undefined,
    routingOrder: s['routingOrder'] != null ? String(s['routingOrder']) : undefined,
    status: typeof s['status'] === 'string' ? s['status'] : undefined,
    signedDateTime:
      (typeof s['signedDateTime'] === 'string' ? s['signedDateTime'] : undefined) ??
      (typeof s['SignedDateTime'] === 'string' ? (s['SignedDateTime'] as string) : undefined),
    recipientId: s['recipientId'] != null ? String(s['recipientId']) : undefined,
  }));
}

/** Identify the Shanken countersigner (routing order 2) once they have signed. */
export function extractCountersignerFromSigners(signers: DocuSignSignerRow[]): {
  email: string;
  name: string;
  signedDateTime: string;
} | null {
  const second = signers.filter((s) => s.routingOrder === '2');
  const completed = second.find((s) => {
    const st = (s.status ?? '').toLowerCase();
    return (st === 'completed' || st === 'signed') && s.email && s.signedDateTime;
  });
  const pick =
    completed ??
    second.find((s) => s.email && s.signedDateTime) ??
    signers.find((s) => {
      const st = (s.status ?? '').toLowerCase();
      return (
        (st === 'completed' || st === 'signed') &&
        s.email &&
        s.signedDateTime &&
        isWhiskyfestBigSmokeCountersignerEmail(s.email)
      );
    });
  if (!pick?.email || !pick.signedDateTime) return null;
  return {
    email: pick.email.trim(),
    name: (pick.name ?? pick.email).trim(),
    signedDateTime: pick.signedDateTime,
  };
}

/** Void an in-flight envelope so recipients can no longer sign; use before correcting email and re-sending from the app. */
export async function voidEnvelope(envelopeId: string, voidedReason: string): Promise<void> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      status: 'voided',
      voidedReason: voidedReason.slice(0, 1000),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DocuSign voidEnvelope ${res.status}: ${errText}`);
  }
}

export async function resendEnvelopeNotifications(envelopeId: string): Promise<void> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const base = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
  const getRes = await fetch(base, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!getRes.ok) {
    const t = await getRes.text();
    markDocuSignRateLimitedFromResponse(getRes.status, t);
    throw new Error(`DocuSign getRecipients ${getRes.status}: ${t}`);
  }
  const recipients = await getRes.json();
  const putUrl = `${base}?resend_envelope=true`;
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(recipients),
  });
  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`DocuSign resendEnvelope ${putRes.status}: ${t}`);
  }
}

async function postExhibitorSigningView(
  restApiBase: string,
  accountId: string,
  accessToken: string,
  envelopeId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/views/recipient`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    markDocuSignRateLimitedFromResponse(res.status, text);
    throw new Error(`DocuSign createRecipientView ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { url?: string };
  if (!data.url?.trim()) {
    throw new Error('DocuSign did not return a signing URL.');
  }
  return data.url.trim();
}

/** One-time DocuSign signing URL for routing order 1 (exhibitor / winery). */
export async function createExhibitorSigningViewUrl(options: {
  envelopeId: string;
  signerEmail: string;
  signerName: string;
  returnUrl: string;
  /** Exhibitor recipient id — always "1" on envelopes created by this app. Skips getRecipients. */
  recipientId?: string;
  /** When true, attempt even if a recent 429 was seen in this instance (client-facing links). */
  bypassRateLimitGuard?: boolean;
  /** DocuSign recipient-view auth — default none first (token-gated links); email as fallback. */
  authenticationMethods?: readonly ('none' | 'email')[];
}): Promise<string> {
  if (!options.bypassRateLimitGuard) {
    assertDocuSignApiAvailable();
  }
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const recipientId = options.recipientId?.trim() || '1';
  const email = options.signerEmail.trim();
  const userName = options.signerName.trim() || email;
  const baseBody = {
    email,
    userName,
    recipientId,
    returnUrl: options.returnUrl,
  };

  const authMethods = options.authenticationMethods ?? (['none', 'email'] as const);
  let lastErr: unknown;
  for (const authenticationMethod of authMethods) {
    try {
      return await postExhibitorSigningView(restApiBase, accountId, accessToken, options.envelopeId, {
        ...baseBody,
        authenticationMethod,
      });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('USER_AUTHENTICATION_FAILED') || msg.includes('AUTHORIZATION_INVALID_TOKEN')) {
        clearDocuSignSessionCache();
        const retrySession = await getDocuSignSession();
        try {
          return await postExhibitorSigningView(
            retrySession.restApiBase,
            retrySession.accountId,
            retrySession.accessToken,
            options.envelopeId,
            { ...baseBody, authenticationMethod },
          );
        } catch (retryErr) {
          lastErr = retryErr;
        }
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'DocuSign signing view failed'));
}

function signerCompletedStatus(status: string | undefined): boolean {
  const st = (status ?? '').toLowerCase();
  return st === 'completed' || st === 'signed';
}

export type ExhibitorSigningGateResult =
  | { action: 'open_signing'; recipientId: string; signerEmail: string; signerName: string }
  | { action: 'already_signed' }
  | { action: 'envelope_voided' }
  | { action: 'envelope_declined' }
  | { action: 'delivery_failed' }
  | { action: 'no_signature_fields' };

function signerNeedsDeliveryRetry(status: string | undefined): boolean {
  const st = (status ?? '').toLowerCase();
  return st === 'autoresponded' || st === 'faxfailed' || st === 'autorespondedgenerationfailed';
}

/** Check DocuSign before opening a personal-note signing link (avoids empty signing UI). */
export async function resolveExhibitorSigningGate(
  envelopeId: string,
  signerEmail: string,
  options?: { bypassRateLimitGuard?: boolean },
): Promise<ExhibitorSigningGateResult> {
  const bypass = options?.bypassRateLimitGuard;
  const normalizedEmail = signerEmail.trim().toLowerCase();

  const { status: envelopeStatus } = await fetchEnvelopeStatus(envelopeId, { bypassRateLimitGuard: bypass });
  const envLower = envelopeStatus.toLowerCase();
  if (envLower === 'completed') return { action: 'already_signed' };
  if (envLower === 'voided') return { action: 'envelope_voided' };
  if (envLower === 'declined') return { action: 'envelope_declined' };

  const signers = await fetchEnvelopeSigners(envelopeId, { bypassRateLimitGuard: bypass });
  const exhibitor =
    signers.find((s) => s.routingOrder === '1' && s.email?.trim()) ??
    signers.find((s) => s.email?.trim().toLowerCase() === normalizedEmail);
  if (!exhibitor?.recipientId || !exhibitor.email?.trim()) {
    throw new Error('DocuSign exhibitor signer not found on this envelope.');
  }
  if (signerCompletedStatus(exhibitor.status)) {
    return { action: 'already_signed' };
  }
  if (signerNeedsDeliveryRetry(exhibitor.status)) {
    return { action: 'delivery_failed' };
  }

  const signHereCount = await fetchRecipientSignHereTabCount(envelopeId, exhibitor.recipientId, {
    bypassRateLimitGuard: bypass,
  });
  if (signHereCount === 0) {
    return { action: 'no_signature_fields' };
  }

  return {
    action: 'open_signing',
    recipientId: exhibitor.recipientId,
    signerEmail: exhibitor.email.trim(),
    signerName: exhibitor.name?.trim() || exhibitor.email.trim(),
  };
}

async function downloadEnvelopePdfFromUrl(url: string, accessToken: string): Promise<Buffer> {
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

/** Fully executed envelope (combined PDF with certificate). */
export async function downloadCompletedPdf(envelopeId: string): Promise<Buffer> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();

  const q = new URLSearchParams({ certificate: 'true' });
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined?${q}`;

  return downloadEnvelopePdfFromUrl(url, accessToken);
}

/** Contract PDF from an in-flight or completed envelope (document 1 = sent agreement). */
export async function downloadEnvelopeContractPdf(envelopeId: string): Promise<Buffer> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();

  const statusUrl = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}`;
  const statusRes = await fetch(statusUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const statusText = await statusRes.text();
  if (!statusRes.ok) {
    throw new Error(`DocuSign getEnvelope ${statusRes.status}: ${statusText}`);
  }
  const statusData = JSON.parse(statusText) as { status?: string; Status?: string };
  const status = String(statusData.status ?? statusData.Status ?? '').trim();

  if (status.toLowerCase() === 'completed') {
    try {
      return await downloadCompletedPdf(envelopeId);
    } catch {
      /* fall through to document 1 */
    }
  }

  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/documents/1`;
  return downloadEnvelopePdfFromUrl(url, accessToken);
}
