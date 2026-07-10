#!/usr/bin/env node
/**
 * Disable DocuSign sender activity emails for DOCUSIGN_USER_ID.
 * Run from repo root with .env.local loaded (or production env vars).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
} catch {
  console.warn('No .env.local — using process env only');
}

async function getSession() {
  const key = Buffer.from(process.env.DOCUSIGN_RSA_PRIVATE_KEY, 'base64').toString('utf8');
  const authUrl = process.env.DOCUSIGN_AUTH_URL || 'https://account-d.docusign.com';
  const aud = authUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: process.env.DOCUSIGN_INTEGRATION_KEY,
      sub: process.env.DOCUSIGN_USER_ID,
      aud,
      iat: now,
      exp: now + 3600,
      scope: 'signature impersonation',
    },
    key,
    { algorithm: 'RS256' },
  );
  const tokenJson = await (
    await fetch(`https://${aud}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
  ).json();
  const userInfo = await (
    await fetch(`https://${aud}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
  ).json();
  const acct =
    userInfo.accounts.find((a) => a.account_id === process.env.DOCUSIGN_ACCOUNT_ID) ||
    userInfo.accounts[0];
  return {
    accessToken: tokenJson.access_token,
    accountId: acct.account_id,
    base: `${acct.base_uri.replace(/\/$/, '')}/restapi`,
    userId: process.env.DOCUSIGN_USER_ID,
  };
}

const senderEmailNotifications = {
  recipientViewed: 'false',
  envelopeComplete: 'false',
  changedSigner: 'false',
  senderEnvelopeDeclined: 'false',
  withdrawnConsent: 'false',
  purgeDocuments: 'false',
  offlineSigningFailed: 'false',
  deliveryFailed: 'true',
};

const { accessToken, accountId, base, userId } = await getSession();
const settingsUrl = `${base}/v2.1/accounts/${accountId}/users/${userId}/settings`;
const before = await (await fetch(settingsUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })).json();
console.log('Before:', before.senderEmailNotifications);
const res = await fetch(settingsUrl, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ senderEmailNotifications }),
});
console.log('Update status:', res.status, await res.text());
const after = await (await fetch(settingsUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } })).json();
console.log('After:', after.senderEmailNotifications);
