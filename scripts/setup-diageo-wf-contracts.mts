#!/usr/bin/env npx tsx
/**
 * Update the Diageo 2-booth WF contract and create the Diageo 4-booth contract as drafts.
 *
 * Usage:
 *   npx tsx scripts/setup-diageo-wf-contracts.mts           # dry run
 *   npx tsx scripts/setup-diageo-wf-contracts.mts --apply    # write changes
 *
 * Loads .env.production.local then .env.local when present.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { replaceContractBoothBrandsForContract } from '../lib/contract-booth-brands.ts';
import { suggestBrandCategory } from '../lib/brand-category.ts';
import { STANDARD_BOOTH_RATE_CENTS } from '../lib/contracts.ts';
import type { Contract, ContractBoothBrand, Event } from '../types/db.ts';

const WF_EVENT_ID = '286468da-a43c-4f66-b56c-4102b3c60b4a';
const NET_45_AMENDMENT = 'Payment terms: Net 45.';
const BOOTH_RATE_CENTS = STANDARD_BOOTH_RATE_CENTS;

const TWO_BOOTH_SIGNER = {
  signer_1_name: 'Jamie Young',
  signer_1_email: 'Jamie.Young@Diageo.com',
  signer_cc_name: 'Meredith Duffy',
  signer_cc_email: 'Meredith.Duffy@Diageo.com',
};

const FOUR_BOOTH_SIGNER = {
  signer_1_name: 'Ari Anderman',
  signer_1_email: 'Ari.Anderman@Diageo.com',
  signer_cc_name: 'Julian Garcia',
  signer_cc_email: 'Julian.Garcia@diageo.com',
};

const FOUR_BOOTH_BRANDS = [
  { booth_index: 1, brand_name: 'Crown Royal', expressions: [] as string[] },
  { booth_index: 2, brand_name: 'Johnnie Walker', expressions: [] as string[] },
  { booth_index: 3, brand_name: 'Bulleit', expressions: [] as string[] },
  {
    booth_index: 4,
    brand_name: 'Single Malts',
    expressions: ['Lagavulin', 'Oban'],
  },
];

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v && !process.env[k]) process.env[k] = v;
  }
  return true;
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

function normCompany(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isDiageoCompany(contract: Pick<Contract, 'exhibitor_company_name' | 'exhibitor_legal_name'>): boolean {
  const company = normCompany(contract.exhibitor_company_name);
  const legal = normCompany(contract.exhibitor_legal_name);
  return company.includes('diageo') || legal.includes('diageo');
}

function brandNamesForContract(brands: ContractBoothBrand[]): string[] {
  return brands.map((b) => b.brand_name.trim().toLowerCase()).filter(Boolean);
}

function matchesTwoBoothBrands(brands: ContractBoothBrand[]): boolean {
  const names = brandNamesForContract(brands);
  return names.some((n) => n.includes('don julio')) && names.some((n) => n.includes('casamigos'));
}

function matchesFourBoothBrands(brands: ContractBoothBrand[]): boolean {
  const names = brandNamesForContract(brands);
  return (
    names.some((n) => n.includes('crown royal')) &&
    names.some((n) => n.includes('johnnie walker')) &&
    names.some((n) => n.includes('bulleit')) &&
    names.some((n) => n.includes('single malt'))
  );
}

function portalUrl(contractId: string): string {
  return `https://wacontracts.whiskyadvocate.com/contracts/${contractId}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', WF_EVENT_ID)
    .maybeSingle<Event>();
  if (eventErr) throw new Error(eventErr.message);
  if (!event) throw new Error(`WhiskyFest event not found: ${WF_EVENT_ID}`);

  const { data: contracts, error: contractsErr } = await supabase
    .from('contracts')
    .select('*')
    .eq('event_id', WF_EVENT_ID)
    .order('created_at', { ascending: false });
  if (contractsErr) throw new Error(contractsErr.message);

  const diageoContracts = (contracts ?? []).filter(isDiageoCompany) as Contract[];
  if (diageoContracts.length === 0) {
    console.log('No Diageo contracts found for WhiskyFest 2026.');
  }

  const boothBrandsByContract = new Map<string, ContractBoothBrand[]>();
  for (const contract of diageoContracts) {
    const { data: brands, error } = await supabase
      .from('contract_booth_brands')
      .select('*')
      .eq('contract_id', contract.id)
      .order('booth_index', { ascending: true });
    if (error) throw new Error(error.message);
    boothBrandsByContract.set(contract.id, (brands ?? []) as ContractBoothBrand[]);
  }

  let twoBooth =
    diageoContracts.find(
      (c) => c.booth_count === 2 && matchesTwoBoothBrands(boothBrandsByContract.get(c.id) ?? []),
    ) ??
    diageoContracts.find((c) => c.booth_count === 2) ??
    null;

  let fourBooth =
    diageoContracts.find(
      (c) => c.booth_count === 4 && matchesFourBoothBrands(boothBrandsByContract.get(c.id) ?? []),
    ) ?? null;

  const template = twoBooth ?? diageoContracts[0] ?? null;
  const exhibitorLegalName = template?.exhibitor_legal_name?.trim() || 'Diageo North America, Inc.';
  const exhibitorCompanyName = template?.exhibitor_company_name?.trim() || 'Diageo';
  const salesRepId = template?.sales_rep_id ?? null;

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Event: ${event.name} (${event.id})`);
  console.log('');

  if (twoBooth) {
    console.log('Found 2-booth Diageo contract:');
    console.log(`  id: ${twoBooth.id}`);
    console.log(`  status: ${twoBooth.status}`);
    console.log(`  url: ${portalUrl(twoBooth.id)}`);
    console.log('  planned updates: Net 45, Jamie Young signer, Meredith Duffy CC, status=draft');
    if (apply) {
      const { error } = await supabase
        .from('contracts')
        .update({
          ...TWO_BOOTH_SIGNER,
          revision_amendments: NET_45_AMENDMENT,
          status: 'draft',
        })
        .eq('id', twoBooth.id);
      if (error) throw new Error(error.message);
      console.log('  applied.');
    }
  } else {
    console.log('No existing 2-booth Diageo contract found.');
    console.log('  planned create: 2 booths @ $15k, Don Julio + Casamigos, Net 45, Jamie Young signer');
    if (apply) {
      const boothBrands = [
        { booth_index: 1, brand_name: 'Don Julio', expressions: [] as string[] },
        { booth_index: 2, brand_name: 'Casamigos', expressions: [] as string[] },
      ];
      const { data: created, error } = await supabase
        .from('contracts')
        .insert({
          event_id: WF_EVENT_ID,
          exhibitor_legal_name: exhibitorLegalName,
          exhibitor_company_name: exhibitorCompanyName,
          order_type: 'booth',
          booth_count: 2,
          booth_rate_cents: BOOTH_RATE_CENTS,
          sales_rep_id: salesRepId,
          brands_poured: 'Don Julio, Casamigos',
          created_by: 'scripts/setup-diageo-wf-contracts.mts',
          status: 'draft',
          revision_amendments: NET_45_AMENDMENT,
          ...TWO_BOOTH_SIGNER,
        })
        .select('*')
        .single<Contract>();
      if (error) throw new Error(error.message);
      await replaceContractBoothBrandsForContract(
        supabase,
        created.id,
        2,
        boothBrands.map((row) => ({
          ...row,
          brand_category: suggestBrandCategory(row.brand_name, exhibitorCompanyName, row.expressions),
        })),
      );
      twoBooth = created;
      console.log(`  created: ${created.id}`);
      console.log(`  url: ${portalUrl(created.id)}`);
    }
  }

  console.log('');

  if (fourBooth) {
    console.log('Found 4-booth Diageo contract:');
    console.log(`  id: ${fourBooth.id}`);
    console.log(`  status: ${fourBooth.status}`);
    console.log(`  url: ${portalUrl(fourBooth.id)}`);
    console.log('  planned updates: Net 45, Ari Anderman signer, Julian Garcia CC, status=draft');
    if (apply) {
      const { error } = await supabase
        .from('contracts')
        .update({
          ...FOUR_BOOTH_SIGNER,
          revision_amendments: NET_45_AMENDMENT,
          booth_rate_cents: BOOTH_RATE_CENTS,
          status: 'draft',
        })
        .eq('id', fourBooth.id);
      if (error) throw new Error(error.message);
      await replaceContractBoothBrandsForContract(
        supabase,
        fourBooth.id,
        4,
        FOUR_BOOTH_BRANDS.map((row) => ({
          ...row,
          brand_category: suggestBrandCategory(row.brand_name, exhibitorCompanyName, row.expressions),
        })),
      );
      console.log('  applied.');
    }
  } else {
    console.log('No existing 4-booth Diageo contract found.');
    console.log(
      '  planned create: 4 booths @ $15k ($60k total), Crown Royal / Johnnie Walker / Bulleit / Single Malts, Net 45, Ari Anderman signer',
    );
    if (apply) {
      const { data: created, error } = await supabase
        .from('contracts')
        .insert({
          event_id: WF_EVENT_ID,
          exhibitor_legal_name: exhibitorLegalName,
          exhibitor_company_name: exhibitorCompanyName,
          order_type: 'booth',
          booth_count: 4,
          booth_rate_cents: BOOTH_RATE_CENTS,
          sales_rep_id: salesRepId,
          brands_poured: 'Crown Royal, Johnnie Walker, Bulleit, Single Malts',
          created_by: 'scripts/setup-diageo-wf-contracts.mts',
          status: 'draft',
          revision_amendments: NET_45_AMENDMENT,
          ...FOUR_BOOTH_SIGNER,
        })
        .select('*')
        .single<Contract>();
      if (error) throw new Error(error.message);
      await replaceContractBoothBrandsForContract(
        supabase,
        created.id,
        4,
        FOUR_BOOTH_BRANDS.map((row) => ({
          ...row,
          brand_category: suggestBrandCategory(row.brand_name, exhibitorCompanyName, row.expressions),
        })),
      );
      fourBooth = created;
      console.log(`  created: ${created.id}`);
      console.log(`  url: ${portalUrl(created.id)}`);
    }
  }

  console.log('');
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write changes.');
  } else {
    console.log('Done.');
    if (twoBooth) console.log(`2-booth draft: ${portalUrl(twoBooth.id)}`);
    if (fourBooth) console.log(`4-booth draft: ${portalUrl(fourBooth.id)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
