import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { canImportLegacyContracts, resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clearedRepEnteredBilling } from '@/lib/contract-schemas';
import { suggestBrandCategory } from '@/lib/brand-category';
import { replaceContractBoothBrandsForContract } from '@/lib/contract-booth-brands';
import { replaceContractLineItemsForContract } from '@/lib/contract-line-items';
import { persistContractSignedPdf } from '@/lib/contract-pdf-storage';
import { isDiscountedRate } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract } from '@/types/db';

export const runtime = 'nodejs';
const MAX_IMPORT_PDF_BYTES = 10 * 1024 * 1024; // 10MB

function parseMoneyToCents(raw: string): number | null {
  const t = raw.replace(/[$,]/g, '').trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const boothBrandRowSchema = z.object({
  booth_index: z.number().int().min(1),
  brand_name: z.string().min(1),
  brand_category: z.string().optional(),
  expressions: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!canImportLegacyContracts(gate.actor)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });

  const pdf = form.get('signed_pdf');
  if (!(pdf instanceof Blob) || pdf.size === 0) {
    return NextResponse.json({ error: 'A signed PDF file is required.' }, { status: 400 });
  }
  if (pdf.size > MAX_IMPORT_PDF_BYTES) {
    return NextResponse.json({ error: 'PDF must be under 10 MB.' }, { status: 400 });
  }
  if (pdf.type && pdf.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Signed file must be a PDF.' }, { status: 400 });
  }

  const boothBrandsRaw = String(form.get('booth_brands_json') ?? '').trim();
  let boothBrandsParsed: z.infer<typeof boothBrandRowSchema>[] = [];
  if (boothBrandsRaw) {
    try {
      const arr = JSON.parse(boothBrandsRaw) as unknown;
      if (!Array.isArray(arr)) throw new Error('expected array');
      boothBrandsParsed = arr.map((row) => boothBrandRowSchema.parse(row));
    } catch {
      return NextResponse.json({ error: 'Invalid booth brands JSON.' }, { status: 400 });
    }
  }

  const bodySchema = z.object({
    event_id: z.string().uuid(),
    exhibitor_company_name: z.string().trim().min(1),
    exhibitor_legal_name: z.string().trim().min(1),
    signer_1_name: z.string().trim().min(1),
    signer_1_email: z.string().trim().email(),
    signer_1_title: z.string().optional().nullable(),
    exhibitor_telephone: z.string().optional().nullable(),
    exhibitor_address_line1: z.string().optional().nullable(),
    exhibitor_address_line2: z.string().optional().nullable(),
    exhibitor_city: z.string().optional().nullable(),
    exhibitor_state: z.string().optional().nullable(),
    exhibitor_zip: z.string().optional().nullable(),
    exhibitor_country: z.string().optional().nullable(),
    sales_rep_id: z.string().uuid(),
    booth_count: z.coerce.number().int().min(1),
    booth_rate_dollars: z.string().min(1),
    grand_total_dollars: z.string().min(1),
    originally_signed_at: z.string().min(1),
    notes: z.string().optional().nullable(),
    billing_contact_name: z.string().optional().nullable(),
    billing_contact_email: z.string().optional().nullable(),
    billing_address_notes: z.string().optional().nullable(),
  });

  const parsed = bodySchema.safeParse({
    event_id: String(form.get('event_id') ?? ''),
    exhibitor_company_name: String(form.get('exhibitor_company_name') ?? ''),
    exhibitor_legal_name: String(form.get('exhibitor_legal_name') ?? ''),
    signer_1_name: String(form.get('signer_1_name') ?? ''),
    signer_1_email: String(form.get('signer_1_email') ?? ''),
    signer_1_title: form.get('signer_1_title') ? String(form.get('signer_1_title')) : null,
    exhibitor_telephone: form.get('exhibitor_telephone') ? String(form.get('exhibitor_telephone')) : null,
    exhibitor_address_line1: form.get('exhibitor_address_line1') ? String(form.get('exhibitor_address_line1')) : null,
    exhibitor_address_line2: form.get('exhibitor_address_line2') ? String(form.get('exhibitor_address_line2')) : null,
    exhibitor_city: form.get('exhibitor_city') ? String(form.get('exhibitor_city')) : null,
    exhibitor_state: form.get('exhibitor_state') ? String(form.get('exhibitor_state')) : null,
    exhibitor_zip: form.get('exhibitor_zip') ? String(form.get('exhibitor_zip')) : null,
    exhibitor_country: form.get('exhibitor_country') ? String(form.get('exhibitor_country')) : null,
    sales_rep_id: String(form.get('sales_rep_id') ?? ''),
    booth_count: form.get('booth_count'),
    booth_rate_dollars: String(form.get('booth_rate_dollars') ?? ''),
    grand_total_dollars: String(form.get('grand_total_dollars') ?? ''),
    originally_signed_at: String(form.get('originally_signed_at') ?? ''),
    notes: form.get('notes') ? String(form.get('notes')) : null,
    billing_contact_name: form.get('billing_contact_name') ? String(form.get('billing_contact_name')) : null,
    billing_contact_email: form.get('billing_contact_email') ? String(form.get('billing_contact_email')) : null,
    billing_address_notes: form.get('billing_address_notes') ? String(form.get('billing_address_notes')) : null,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    if (!gate.actor.accessibleSalesRepIds.includes(p.sales_rep_id)) {
      return NextResponse.json(
        { error: 'You can only import contracts assigned to yourself or reps you assist.' },
        { status: 403 },
      );
    }
  }

  const booth_rate_cents = parseMoneyToCents(p.booth_rate_dollars);
  const grand_total_cents = parseMoneyToCents(p.grand_total_dollars);
  if (booth_rate_cents === null || grand_total_cents === null) {
    return NextResponse.json({ error: 'Booth rate and grand total must be valid dollar amounts.' }, { status: 400 });
  }

  let signedDay = p.originally_signed_at.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(signedDay)) {
    signedDay = `${signedDay}T12:00:00.000Z`;
  } else {
    const d = new Date(p.originally_signed_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Original signature date is invalid.' }, { status: 400 });
    }
    signedDay = d.toISOString();
  }

  const seen = new Set<number>();
  for (const row of boothBrandsParsed) {
    if (seen.has(row.booth_index)) {
      return NextResponse.json({ error: 'Duplicate booth_index in booth brands.' }, { status: 400 });
    }
    seen.add(row.booth_index);
    if (row.booth_index > p.booth_count) {
      return NextResponse.json({ error: 'Booth brand index exceeds booth count.' }, { status: 400 });
    }
  }
  for (let i = 1; i <= p.booth_count; i++) {
    const row = boothBrandsParsed.find((r) => r.booth_index === i);
    if (!row?.brand_name?.trim()) {
      return NextResponse.json({ error: `Brand name is required for booth ${i}.` }, { status: 400 });
    }
  }

  const boothSubtotalCheck = p.booth_count * booth_rate_cents;
  if (grand_total_cents < boothSubtotalCheck) {
    return NextResponse.json(
      { error: 'Grand total cannot be less than booth count × rate per booth.' },
      { status: 400 },
    );
  }

  const bill = clearedRepEnteredBilling();
  const nowIso = new Date().toISOString();
  const actorEmail = gate.actor.email;

  let notesCombined = (p.notes ?? '').trim();
  if (p.billing_address_notes?.trim()) {
    notesCombined = `${notesCombined}${notesCombined ? '\n\n' : ''}Billing address (import):\n${p.billing_address_notes.trim()}`;
  }
  if (!notesCombined) notesCombined = 'Imported pre-existing signed contract.';

  const supabase = getSupabaseAdmin();

  const discounted = isDiscountedRate(booth_rate_cents);

  const insertPayload: Record<string, unknown> = {
    event_id: p.event_id,
    status: 'imported',
    imported_at: nowIso,
    imported_by: actorEmail,
    originally_signed_at: signedDay,
    signed_at: signedDay,
    exhibitor_legal_name: p.exhibitor_legal_name,
    exhibitor_company_name: p.exhibitor_company_name,
    brands_poured: null,
    booth_count: p.booth_count,
    booth_rate_cents,
    additional_brand_count: 0,
    signer_1_name: p.signer_1_name,
    signer_1_title: p.signer_1_title ?? null,
    signer_1_email: p.signer_1_email,
    sales_rep_id: p.sales_rep_id,
    billing_contact_name: p.billing_contact_name ?? null,
    billing_contact_email: p.billing_contact_email ?? null,
    notes: notesCombined,
    created_by: actorEmail,
    ...bill,
    exhibitor_address_line1: p.exhibitor_address_line1 ?? null,
    exhibitor_address_line2: p.exhibitor_address_line2 ?? null,
    exhibitor_city: p.exhibitor_city ?? null,
    exhibitor_state: p.exhibitor_state ?? null,
    exhibitor_zip: p.exhibitor_zip ?? null,
    exhibitor_country: p.exhibitor_country ?? null,
    exhibitor_telephone: p.exhibitor_telephone ?? null,
    ...(discounted
      ? {
          discount_approved_at: nowIso,
          discount_approved_by: actorEmail,
          discount_approval_reason: 'Imported legacy contract — negotiated rate acknowledged at import.',
        }
      : {}),
  };

  const { data: row, error: insErr } = await supabase.from('contracts').insert(insertPayload).select().single();

  if (insErr || !row) {
    console.error('import contract insert:', insErr);
    return NextResponse.json({ error: insErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  const contract = row as Contract;
  const contractId = contract.id;

  const boothSubtotal = p.booth_count * booth_rate_cents;
  const remainder = grand_total_cents - boothSubtotal;
  const lineRows: { description: string; amount_cents: number }[] = [];
  if (remainder > 0) {
    lineRows.push({
      description: 'Imported adjustments (total vs booth package)',
      amount_cents: remainder,
    });
  }

  try {
    await replaceContractLineItemsForContract(supabase, contractId, lineRows);
    await replaceContractBoothBrandsForContract(
      supabase,
      contractId,
      p.booth_count,
      boothBrandsParsed.map((r) => ({
        booth_index: r.booth_index,
        brand_name: r.brand_name.trim(),
        brand_category:
          r.brand_category?.trim() ||
          suggestBrandCategory(r.brand_name, p.exhibitor_company_name, r.expressions ?? []),
        expressions: r.expressions ?? [],
      })),
    );
  } catch (e) {
    console.error('import contract line items / booth brands:', e);
    await supabase.from('contracts').delete().eq('id', contractId);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save line items or booth brands.' },
      { status: 500 },
    );
  }

  const buf = Buffer.from(await pdf.arrayBuffer());
  let signedStoragePath: string;
  try {
    ({ signedStoragePath } = await persistContractSignedPdf(contractId, buf));
  } catch (e) {
    console.error('import pdf upload:', e);
    await supabase.from('contracts').delete().eq('id', contractId);
    return NextResponse.json({ error: 'Failed to upload PDF to storage.' }, { status: 500 });
  }

  const { error: pdfUpdErr } = await supabase
    .from('contracts')
    .update({ pdf_storage_path: signedStoragePath, signed_pdf_url: signedStoragePath })
    .eq('id', contractId);

  if (pdfUpdErr) {
    console.error('import pdf path update:', pdfUpdErr);
  }

  await supabase.from('audit_log').insert({
    contract_id: contractId,
    actor_email: actorEmail,
    action: 'contract_imported',
    to_status: 'imported',
    metadata: { originally_signed_at: signedDay },
  });

  revalidateContractPaths(contractId);

  return NextResponse.json({ ok: true, id: contractId });
}
