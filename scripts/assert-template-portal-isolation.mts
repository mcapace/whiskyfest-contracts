#!/usr/bin/env tsx
/**
 * Assert portal template isolation: Big Smoke / NYWE never resolve to WhiskyFest env docs.
 *
 * Usage:
 *   npx tsx scripts/assert-template-portal-isolation.mts
 */

import { resolveContractTemplateDocId } from '../lib/contract-template';

const WF_BOOTH = 'wf-booth-env';
const WF_SPO = 'wf-spo-env';
const BS_FALLBACK = 'bs-fallback-env';

process.env.GOOGLE_TEMPLATE_DOC_ID = WF_BOOTH;
process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID = WF_SPO;
process.env.BIG_SMOKE_TEMPLATE_DOC_ID = BS_FALLBACK;

type Case = {
  name: string;
  contract: { order_type: string; booth_count: number };
  event: {
    name: string;
    contract_template_profile: string;
    google_template_doc_id: string | null;
    google_sponsorship_template_doc_id: string | null;
  };
  expect: string | 'throw';
};

const cases: Case[] = [
    {
      name: 'Big Smoke sponsorship with no event spo id → BS sponsorship master, NOT WF spo',
      contract: { order_type: 'sponsorship_only', booth_count: 0 },
      event: {
        name: 'Big Smoke Las Vegas 2026',
        contract_template_profile: 'big_smoke',
        google_template_doc_id: 'bs-booth-event',
        google_sponsorship_template_doc_id: null,
      },
      expect: '1U3qWOoi5tZafogebwEncGzaY5ITH_eNDL3dsxgawzFY',
    },
    {
      name: 'Big Smoke sponsorship with no templates → BS sponsorship master, NOT WF spo',
      contract: { order_type: 'sponsorship_only', booth_count: 0 },
      event: {
        name: 'Big Smoke Las Vegas 2026',
        contract_template_profile: 'big_smoke',
        google_template_doc_id: null,
        google_sponsorship_template_doc_id: null,
      },
      expect: '1U3qWOoi5tZafogebwEncGzaY5ITH_eNDL3dsxgawzFY',
    },
  {
    name: 'Big Smoke booth uses event template',
    contract: { order_type: 'booth', booth_count: 1 },
    event: {
      name: 'Big Smoke Las Vegas 2026',
      contract_template_profile: 'big_smoke',
      google_template_doc_id: 'bs-booth-event',
      google_sponsorship_template_doc_id: null,
    },
    expect: 'bs-booth-event',
  },
  {
    name: 'NYWE sponsorship uses event spo id',
    contract: { order_type: 'sponsorship_only', booth_count: 0 },
    event: {
      name: 'NYWE 2026',
      contract_template_profile: 'nywe_vendor',
      google_template_doc_id: 'nywe-license',
      google_sponsorship_template_doc_id: 'nywe-spo',
    },
    expect: 'nywe-spo',
  },
  {
    name: 'NYWE sponsorship without spo id falls back to license doc (not WF)',
    contract: { order_type: 'sponsorship_only', booth_count: 0 },
    event: {
      name: 'NYWE 2026',
      contract_template_profile: 'nywe_vendor',
      google_template_doc_id: 'nywe-license',
      google_sponsorship_template_doc_id: null,
    },
    expect: 'nywe-license',
  },
  {
    name: 'NYWE license without event doc throws (no WF bleed)',
    contract: { order_type: 'booth', booth_count: 1 },
    event: {
      name: 'NYWE 2026',
      contract_template_profile: 'nywe_vendor',
      google_template_doc_id: null,
      google_sponsorship_template_doc_id: null,
    },
    expect: 'throw',
  },
  {
    name: 'WhiskyFest sponsorship uses WF spo env when event empty',
    contract: { order_type: 'sponsorship_only', booth_count: 0 },
    event: {
      name: 'WhiskyFest New York',
      contract_template_profile: 'whiskyfest',
      google_template_doc_id: null,
      google_sponsorship_template_doc_id: null,
    },
    expect: WF_SPO,
  },
  {
    name: 'WhiskyFest booth uses WF booth env when event empty',
    contract: { order_type: 'booth', booth_count: 1 },
    event: {
      name: 'WhiskyFest New York',
      contract_template_profile: 'whiskyfest',
      google_template_doc_id: null,
      google_sponsorship_template_doc_id: null,
    },
    expect: WF_BOOTH,
  },
];

let failed = 0;
for (const c of cases) {
  try {
    const got = resolveContractTemplateDocId(c.contract, c.event as any);
    if (c.expect === 'throw') {
      console.error(`FAIL ${c.name}: expected throw, got ${got}`);
      failed++;
    } else if (got !== c.expect) {
      console.error(`FAIL ${c.name}: expected ${c.expect}, got ${got}`);
      failed++;
    } else {
      console.log(`OK   ${c.name}`);
    }
  } catch (err) {
    if (c.expect === 'throw') {
      console.log(`OK   ${c.name}`);
    } else {
      console.error(`FAIL ${c.name}: unexpected throw`, err);
      failed++;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll portal isolation assertions passed.');
