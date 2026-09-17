import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Diagnose contract display issues for NYWE 2026
 * Issues: Allegrini/Fontodi, Château Pichon/First Drop, Jermann portal
 */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const results: any = {
    timestamp: new Date().toISOString(),
    issues: {},
  };

  try {
    // Issue 1: Allegrini and Fontodi
    const { data: allegrini } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at, created_at')
      .or('exhibitor_company_name.ilike.%Allegrini%,exhibitor_legal_name.ilike.%Allegrini%')
      .order('created_at', { ascending: false });

    const { data: fontodi } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at, created_at')
      .or('exhibitor_company_name.ilike.%Fontodi%,exhibitor_legal_name.ilike.%Fontodi%')
      .order('created_at', { ascending: false });

    results.issues.allegrini_fontodi = {
      allegrini: allegrini || [],
      fontodi: fontodi || [],
      sharedPdfIds: [],
      sharedEnvelopeIds: [],
    };

    if (allegrini && fontodi) {
      const allegriniPdfIds = allegrini.map(c => c.google_drive_pdf_id).filter(Boolean);
      const fontodiPdfIds = fontodi.map(c => c.google_drive_pdf_id).filter(Boolean);
      results.issues.allegrini_fontodi.sharedPdfIds = allegriniPdfIds.filter(id => fontodiPdfIds.includes(id));

      const allegriniEnvIds = allegrini.map(c => c.docusign_envelope_id).filter(Boolean);
      const fontodiEnvIds = fontodi.map(c => c.docusign_envelope_id).filter(Boolean);
      results.issues.allegrini_fontodi.sharedEnvelopeIds = allegriniEnvIds.filter(id => fontodiEnvIds.includes(id));
    }

    // Issue 2: Château Pichon and First Drop
    const { data: pichon } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at, created_at')
      .or('exhibitor_company_name.ilike.%Pichon%,exhibitor_legal_name.ilike.%Pichon%')
      .order('created_at', { ascending: false });

    const { data: firstDrop } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, exhibitor_legal_name, status, docusign_envelope_id, google_drive_pdf_id, executed_at, created_at')
      .or('exhibitor_company_name.ilike.%First Drop%,exhibitor_legal_name.ilike.%First Drop%')
      .order('created_at', { ascending: false });

    results.issues.pichon_firstdrop = {
      pichon: pichon || [],
      firstDrop: firstDrop || [],
      sharedPdfIds: [],
      sharedEnvelopeIds: [],
    };

    if (pichon && firstDrop) {
      const pichonPdfIds = pichon.map(c => c.google_drive_pdf_id).filter(Boolean);
      const firstDropPdfIds = firstDrop.map(c => c.google_drive_pdf_id).filter(Boolean);
      results.issues.pichon_firstdrop.sharedPdfIds = pichonPdfIds.filter(id => firstDropPdfIds.includes(id));

      const pichonEnvIds = pichon.map(c => c.docusign_envelope_id).filter(Boolean);
      const firstDropEnvIds = firstDrop.map(c => c.docusign_envelope_id).filter(Boolean);
      results.issues.pichon_firstdrop.sharedEnvelopeIds = pichonEnvIds.filter(id => firstDropEnvIds.includes(id));
    }

    // Issue 3: Jermann portal
    const { data: jermann } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, exhibitor_legal_name, status, portal_host, docusign_envelope_id, executed_at, created_at')
      .or('exhibitor_company_name.ilike.%Jermann%,exhibitor_legal_name.ilike.%Jermann%')
      .order('created_at', { ascending: false });

    results.issues.jermann = {
      contracts: jermann || [],
    };

    // Issue 4: Gallo wineries
    const galloWineries = ['Louis M. Martini', 'Massican', 'Pahlmeyer', 'Rombauer', 'Jermann'];
    results.issues.gallo = {};

    for (const winery of galloWineries) {
      const { data } = await supabase
        .from('contracts')
        .select('id, exhibitor_company_name, status, executed_at, created_at')
        .ilike('exhibitor_company_name', `%${winery}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      results.issues.gallo[winery] = data && data.length > 0 ? data[0] : null;
    }

    // Check for any duplicate PDF IDs across all contracts
    const { data: allContracts } = await supabase
      .from('contracts')
      .select('id, exhibitor_company_name, google_drive_pdf_id, docusign_envelope_id')
      .not('google_drive_pdf_id', 'is', null)
      .neq('google_drive_pdf_id', '');

    const pdfIdMap: Record<string, string[]> = {};
    allContracts?.forEach(c => {
      if (c.google_drive_pdf_id) {
        if (!pdfIdMap[c.google_drive_pdf_id]) {
          pdfIdMap[c.google_drive_pdf_id] = [];
        }
        pdfIdMap[c.google_drive_pdf_id].push(c.exhibitor_company_name);
      }
    });

    results.duplicatePdfIds = Object.entries(pdfIdMap)
      .filter(([_, wineries]) => wineries.length > 1)
      .map(([pdfId, wineries]) => ({ pdfId, wineries }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
