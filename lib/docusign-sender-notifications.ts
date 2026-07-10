import { getDocuSignAccountId, getDocuSignSession } from '@/lib/docusign';

export type DocuSignSenderEmailNotifications = {
  envelopeComplete?: string;
  changedSigner?: string;
  senderEnvelopeDeclined?: string;
  withdrawnConsent?: string;
  recipientViewed?: string;
  deliveryFailed?: string;
  offlineSigningFailed?: string;
  purgeDocuments?: string;
};

function apiUserId(): string {
  const id = process.env['DOCUSIGN_USER_ID']?.trim();
  if (!id) throw new Error('DOCUSIGN_USER_ID is not set');
  return id;
}

/** Read sender notification prefs for the JWT API user (envelope "sender" in DocuSign). */
export async function fetchDocuSignSenderEmailNotifications(): Promise<DocuSignSenderEmailNotifications> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const userId = apiUserId();
  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/settings`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSign getUserSettings ${res.status}: ${text}`);
  }
  const data = JSON.parse(text) as { senderEmailNotifications?: DocuSignSenderEmailNotifications };
  return data.senderEmailNotifications ?? {};
}

/**
 * DocuSign emails the JWT API user (DOCUSIGN_USER_ID) as the envelope sender for every API send.
 * Disable activity noise (viewed / complete / etc.); keep delivery failures for ops visibility.
 */
export async function applyQuietDocuSignSenderEmailNotifications(): Promise<DocuSignSenderEmailNotifications> {
  const { accessToken, accountId, restApiBase } = await getDocuSignSession();
  const userId = apiUserId();
  const senderEmailNotifications: DocuSignSenderEmailNotifications = {
    recipientViewed: 'false',
    envelopeComplete: 'false',
    changedSigner: 'false',
    senderEnvelopeDeclined: 'false',
    withdrawnConsent: 'false',
    purgeDocuments: 'false',
    offlineSigningFailed: 'false',
    deliveryFailed: 'true',
  };

  const url = `${restApiBase}/v2.1/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/settings`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ senderEmailNotifications }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`DocuSign updateUserSettings ${res.status}: ${text}`);
  }

  void getDocuSignAccountId(); // ensure env present (throws early if misconfigured)
  return senderEmailNotifications;
}
