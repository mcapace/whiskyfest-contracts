#!/usr/bin/env tsx
/**
 * Diagnose QR code mismatches
 * Find out why Ca'Marcanda links to Diamond Creek and GAJA links to VIK
 */

import { getSupabaseAdmin } from '../lib/supabase.js';
import { getRebrandlyLink } from '../lib/rebrandly.js';

async function diagnose() {
  const supabase = getSupabaseAdmin();

  console.log('=== Checking Ca\'Marcanda ===\n');
  
  const { data: camarcanda } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, rebrandly_short_url, rebrandly_link_id')
    .ilike('exhibitor_company_name', '%Marcanda%');

  if (camarcanda && camarcanda.length > 0) {
    for (const c of camarcanda) {
      console.log(`Contract: ${c.exhibitor_company_name}`);
      console.log(`  ID: ${c.id}`);
      console.log(`  Database URL: ${c.exhibitor_website_url}`);
      console.log(`  Short URL: ${c.rebrandly_short_url}`);
      
      if (c.rebrandly_link_id) {
        try {
          const link = await getRebrandlyLink(c.rebrandly_link_id);
          console.log(`  Rebrandly Destination: ${link.destination}`);
          console.log(`  Expected: https://nywecontracts.winespectator.com/b/${c.id}`);
        } catch (err) {
          console.log(`  Rebrandly Error: ${err}`);
        }
      }
      console.log('');
    }
  }

  console.log('=== Checking GAJA ===\n');
  
  const { data: gaja } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, rebrandly_short_url, rebrandly_link_id')
    .ilike('exhibitor_company_name', '%GAJA%')
    .not('exhibitor_company_name', 'ilike', '%Marcanda%')
    .not('exhibitor_company_name', 'ilike', '%Pieve%');

  if (gaja && gaja.length > 0) {
    for (const g of gaja) {
      console.log(`Contract: ${g.exhibitor_company_name}`);
      console.log(`  ID: ${g.id}`);
      console.log(`  Database URL: ${g.exhibitor_website_url}`);
      console.log(`  Short URL: ${g.rebrandly_short_url}`);
      
      if (g.rebrandly_link_id) {
        try {
          const link = await getRebrandlyLink(g.rebrandly_link_id);
          console.log(`  Rebrandly Destination: ${link.destination}`);
          console.log(`  Expected: https://nywecontracts.winespectator.com/b/${g.id}`);
        } catch (err) {
          console.log(`  Rebrandly Error: ${err}`);
        }
      }
      console.log('');
    }
  }

  console.log('=== Checking Diamond Creek ===\n');
  
  const { data: diamond } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, rebrandly_short_url, rebrandly_link_id')
    .ilike('exhibitor_company_name', '%Diamond Creek%');

  if (diamond && diamond.length > 0) {
    for (const d of diamond) {
      console.log(`Contract: ${d.exhibitor_company_name}`);
      console.log(`  ID: ${d.id}`);
      console.log(`  Database URL: ${d.exhibitor_website_url}`);
      console.log(`  Short URL: ${d.rebrandly_short_url}`);
      console.log('');
    }
  }

  console.log('=== Checking VIK ===\n');
  
  const { data: vik } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, rebrandly_short_url, rebrandly_link_id')
    .ilike('exhibitor_company_name', '%VIK%');

  if (vik && vik.length > 0) {
    for (const v of vik) {
      console.log(`Contract: ${v.exhibitor_company_name}`);
      console.log(`  ID: ${v.id}`);
      console.log(`  Database URL: ${v.exhibitor_website_url}`);
      console.log(`  Short URL: ${v.rebrandly_short_url}`);
      console.log('');
    }
  }
}

diagnose()
  .then(() => console.log('Done'))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
