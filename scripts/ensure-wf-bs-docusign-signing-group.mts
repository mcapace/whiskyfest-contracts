#!/usr/bin/env npx tsx
/**
 * Print DocuSign signing-group setup steps for WhiskyFest / Big Smoke countersigners.
 *
 *   npx tsx scripts/ensure-wf-bs-docusign-signing-group.mts
 */
import { wfBsSigningGroupSetupInstructions } from '../lib/docusign-signing-groups';
import { WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS } from '../lib/wf-bslv-countersigner';

async function main() {
  console.log(wfBsSigningGroupSetupInstructions());
  console.log('');
  console.log('Members:', WHISKYFEST_BIG_SMOKE_COUNTERSIGNER_EMAILS.join(', '));
  const configured = process.env['DOCUSIGN_WF_BS_COUNTERSIGN_SIGNING_GROUP_ID']?.trim();
  if (configured) {
    console.log('');
    console.log('Configured signing group id:', configured);
  }
}

main();
