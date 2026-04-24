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
  // Prefer account-scoped base_uri from userinfo; DOCUSIGN_BASE_URL can be stale/wrong cluster.
  const restApiBase = normalizeRestApiBase(chosen.base_uri ?? '') || envBase?.replace(/\/$/, '');
  if (!restApiBase) throw new Error('DocuSign userinfo did not provide base_uri and DOCUSIGN_BASE_URL is not set');

  return { accountId, restApiBase };
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
  countersigner: { email: string; name: string };
}

export async function sendEnvelope(params: SendEnvelopeParams): Promise<{ envelopeId: string }> {
  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);

  const signHere1 = anchorOnly(DOCUSIGN_ANCHORS.sig1);
  const date1 = anchorOnly(DOCUSIGN_ANCHORS.date1);
  const signHere2 = anchorOnly(DOCUSIGN_ANCHORS.sig2);
  const date2 = anchorOnly(DOCUSIGN_ANCHORS.date2);

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
          email: params.countersigner.email,
          name: params.countersigner.name,
          recipientId: '2',
          routingOrder: '2',
          roleName: 'Countersigner',
          tabs: {
            signHereTabs: [signHere2],
            dateSignedTabs: [date2],
          },
        },
      ],
    },
  };

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

/** Load envelope recipients (signers) for webhook / audit (actual countersigner identity after signing group completes). */
export async function fetchEnvelopeSigners(envelopeId: string): Promise<DocuSignSignerRow[]> {
  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
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
  const pick = completed ?? second.find((s) => s.email && s.signedDateTime);
  if (!pick?.email || !pick.signedDateTime) return null;
  return {
    email: pick.email.trim(),
    name: (pick.name ?? pick.email).trim(),
    signedDateTime: pick.signedDateTime,
  };
}

/** Void an in-flight envelope so recipients can no longer sign; use before correcting email and re-sending from the app. */
export async function voidEnvelope(envelopeId: string, voidedReason: string): Promise<void> {
  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);
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

/**
 * Ask DocuSign to resend notification emails to recipients who have not completed signing.
 * Same recipient emails as the live envelope — use Recall if you need to change the address.
 */
export async function resendEnvelopeNotifications(envelopeId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);
  const base = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/recipients`;
  const getRes = await fetch(base, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!getRes.ok) {
    const t = await getRes.text();
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

export async function downloadCompletedPdf(envelopeId: string): Promise<Buffer> {
  const accessToken = await getAccessToken();
  const { accountId, restApiBase } = await resolveApiContext(accessToken);

  const q = new URLSearchParams({ certificate: 'true' });
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/envelopes/${encodeURIComponent(envelopeId)}/documents/combined?${q}`;

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
