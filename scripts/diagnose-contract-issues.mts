#!/usr/bin/env tsx
/**
 * Diagnose contract display issues for NYWE 2026
 * Issues: Allegrini/Fontodi, Château Pichon/First Drop, Jermann portal
 */

import { getSupabaseAdmin } from '../lib/supabase.js';

async function diagnose() {
  const supabase = getSupabaseAdmin();
  
  console.log('=== NYWE 2026 Contract Issues Diagnostic ===\n');
  
  // ============================================================
  // Issue 1: Allegrini showing Fontodi contract
  // ============================================================
  console.log('1. CHECKING ALLEGRINI AND FONTODI\n');
  
  const { data: allegrini } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at')
    .or('exhibitor_company_name.ilike.%Allegrini%,exhibitor_legal_name.ilike.%Allegrini%')
    .order('created_at', { ascending: false });
  
  const { data: fontodi } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at')
    .or('exhibitor_company_name.ilike.%Fontodi%,exhibitor_legal_name.ilike.%Fontodi%')
    .order('created_at', { ascending: false });
  
  console.log('Allegrini contracts:', allegrini?.length || 0);
  if (allegrini && allegrini.length > 0) {
    allegrini.forEach(c => {
      console.log(`  ${c.exhibitor_company_name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    DocuSign: ${c.docusign_envelope_id || 'none'}`);
      console.log(`    PDF ID: ${c.google_drive_pdf_id || 'none'}`);
      console.log(`    Executed: ${c.executed_at || 'not executed'}`);
    });
  }
  
  console.log('\nFontodi contracts:', fontodi?.length || 0);
  if (fontodi && fontodi.length > 0) {
    fontodi.forEach(c => {
      console.log(`  ${c.exhibitor_company_name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    DocuSign: ${c.docusign_envelope_id || 'none'}`);
      console.log(`    PDF ID: ${c.google_drive_pdf_id || 'none'}`);
      console.log(`    Executed: ${c.executed_at || 'not executed'}`);
    });
  }
  
  // Check for shared IDs
  if (allegrini && fontodi) {
    const allegriniPdfIds = allegrini.map(c => c.google_drive_pdf_id).filter(Boolean);
    const fontodiPdfIds = fontodi.map(c => c.google_drive_pdf_id).filter(Boolean);
    const sharedPdfIds = allegriniPdfIds.filter(id => fontodiPdfIds.includes(id));
    
    if (sharedPdfIds.length > 0) {
      console.log('\n⚠️  PROBLEM FOUND: Allegrini and Fontodi share PDF IDs:');
      sharedPdfIds.forEach(id => console.log(`    ${id}`));
    }
    
    const allegriniEnvIds = allegrini.map(c => c.docusign_envelope_id).filter(Boolean);
    const fontodiEnvIds = fontodi.map(c => c.docusign_envelope_id).filter(Boolean);
    const sharedEnvIds = allegriniEnvIds.filter(id => fontodiEnvIds.includes(id));
    
    if (sharedEnvIds.length > 0) {
      console.log('\n⚠️  PROBLEM FOUND: Allegrini and Fontodi share DocuSign envelope IDs:');
      sharedEnvIds.forEach(id => console.log(`    ${id}`));
    }
  }
  
  // ============================================================
  // Issue 2: Château Pichon showing First Drop contract
  // ============================================================
  console.log('\n\n2. CHECKING CHÂTEAU PICHON AND FIRST DROP\n');
  
  const { data: pichon } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at')
    .or('exhibitor_company_name.ilike.%Pichon%,exhibitor_legal_name.ilike.%Pichon%')
    .order('created_at', { ascending: false });
  
  const { data: firstDrop } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at')
    .or('exhibitor_company_name.ilike.%First Drop%,exhibitor_legal_name.ilike.%First Drop%')
    .order('created_at', { ascending: false });
  
  console.log('Château Pichon contracts:', pichon?.length || 0);
  if (pichon && pichon.length > 0) {
    pichon.forEach(c => {
      console.log(`  ${c.exhibitor_company_name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    DocuSign: ${c.docusign_envelope_id || 'none'}`);
      console.log(`    PDF ID: ${c.google_drive_pdf_id || 'none'}`);
      console.log(`    Executed: ${c.executed_at || 'not executed'}`);
    });
  }
  
  console.log('\nFirst Drop contracts:', firstDrop?.length || 0);
  if (firstDrop && firstDrop.length > 0) {
    firstDrop.forEach(c => {
      console.log(`  ${c.exhibitor_company_name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    DocuSign: ${c.docusign_envelope_id || 'none'}`);
      console.log(`    PDF ID: ${c.google_drive_pdf_id || 'none'}`);
      console.log(`    Executed: ${c.executed_at || 'not executed'}`);
    });
  }
  
  // Check for shared IDs
  if (pichon && firstDrop) {
    const pichonPdfIds = pichon.map(c => c.google_drive_pdf_id).filter(Boolean);
    const firstDropPdfIds = firstDrop.map(c => c.google_drive_pdf_id).filter(Boolean);
    const sharedPdfIds = pichonPdfIds.filter(id => firstDropPdfIds.includes(id));
    
    if (sharedPdfIds.length > 0) {
      console.log('\n⚠️  PROBLEM FOUND: Château Pichon and First Drop share PDF IDs:');
      sharedPdfIds.forEach(id => console.log(`    ${id}`));
    }
  }
  
  // ============================================================
  // Issue 3: Jermann portal assignment
  // ============================================================
  console.log('\n\n3. CHECKING JERMANN PORTAL ASSIGNMENT\n');
  
  const { data: jermann } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_legal_name, status, portal_host, docusign_envelope_id, executed_at')
    .or('exhibitor_company_name.ilike.%Jermann%,exhibitor_legal_name.ilike.%Jermann%')
    .order('created_at', { ascending: false });
  
  console.log('Jermann contracts:', jermann?.length || 0);
  if (jermann && jermann.length > 0) {
    jermann.forEach(c => {
      console.log(`  ${c.exhibitor_company_name}`);
      console.log(`    ID: ${c.id}`);
      console.log(`    Status: ${c.status}`);
      console.log(`    Portal: ${c.portal_host || 'none'}`);
      console.log(`    Executed: ${c.executed_at || 'not executed'}`);
    });
  }
  
  // ============================================================
  // Issue 4: Missing Gallo contracts
  // ============================================================
  console.log('\n\n4. CHECKING GALLO WINERIES (5 EXPECTED)\n');
  
  const galloWineries = [
    'Louis M. Martini',
    'Massican',
    'Pahlmeyer',
    'Rombauer',
    'Jermann'
  ];
  
  for (const winery of galloWineries) {
    const { data } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, status, executed_at')
      .ilike('exhibitor_company_name', `%${winery}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      const c = data[0];
      console.log(`${winery}:`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Executed: ${c.executed_at || 'NOT EXECUTED'}`);
    } else {
      console.log(`${winery}: NOT FOUND`);
    }
  }
  
  // ============================================================
  // Summary
  // ============================================================
  console.log('\n\n=== SUMMARY ===');
  console.log('Check the output above for:');
  console.log('1. Shared PDF IDs between Allegrini/Fontodi');
  console.log('2. Shared PDF IDs between Château Pichon/First Drop');
  console.log('3. Incorrect portal_host for Jermann');
  console.log('4. Execution status of 5 Gallo contracts');
}

diagnose()
  .then(() => {
    console.log('\nDiagnostic complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
