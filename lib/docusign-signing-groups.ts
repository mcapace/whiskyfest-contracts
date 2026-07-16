import { WF_BS_COUNTERSIGN_GROUP_LABEL } from '@/lib/wf-bslv-countersigner';

export { WF_BS_COUNTERSIGN_GROUP_LABEL };

const DEFAULT_GROUP_NAME = 'WhiskyFest & Big Smoke Countersigners';

/** DocuSign signing group id (short numeric string) from Admin → Settings → Signing Groups. */
export function configuredWfBsCountersignSigningGroupId(): string | null {
  const id = process.env['DOCUSIGN_WF_BS_COUNTERSIGN_SIGNING_GROUP_ID']?.trim();
  return id || null;
}

export function wfBsSigningGroupSetupInstructions(): string {
  return [
    'DocuSign Signing Groups must be enabled on the Shanken account.',
    `1. In DocuSign Admin → Settings → Signing Groups, create "${DEFAULT_GROUP_NAME}".`,
    '2. Add members: lmott@mshanken.com (Liz), nmazza@mshanken.com (Nicole), talper@mshanken.com (Tobi).',
    '3. Copy the Signing Group ID and set DOCUSIGN_WF_BS_COUNTERSIGN_SIGNING_GROUP_ID in Vercel production.',
    'Until then, routing order 2 falls back to the event signatory (Nicole) — Liz/Tobi still get portal email alerts.',
  ].join(' ');
}

/** Returns signing group id when configured; null triggers single-signer fallback. */
export function resolveWfBsCountersignSigningGroupId(): string | null {
  return configuredWfBsCountersignSigningGroupId();
}
