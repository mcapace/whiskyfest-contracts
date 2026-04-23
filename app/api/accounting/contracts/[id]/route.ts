import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifySalesRepInvoicePaid, notifySalesRepInvoiceSent } from '@/lib/notifications';
import { formatTimestamp } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { ContractWithTotals, InvoiceStatus } from '@/types/db';

export const runtime = 'nodejs';

const bodySchema = z.object({
  mark_invoice_sent: z.boolean().optional(),
  mark_paid: z.boolean().optional(),
  accounting_notes: z.string().max(20000).optional(),
});

async function requireAccountingActor() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const isAdmin = session.user.role === 'admin';
  const isAccounting = Boolean(session.user.is_accounting);
  if (!isAdmin && !isAccounting) return null;

  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase
    .from('app_users')
    .select('is_active')
    .eq('email', session.user.email.toLowerCase())
    .maybeSingle();

  if (!appUser?.is_active) return null;

  return { email: session.user.email.toLowerCase() };
}

/** PATCH — invoice status transitions, or save accounting_notes only. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireAccountingActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { mark_invoice_sent, mark_paid, accounting_notes } = parsed.data;
  const ops = [mark_invoice_sent === true, mark_paid === true, accounting_notes !== undefined].filter(Boolean);
  if (ops.length !== 1) {
    return NextResponse.json(
      { error: 'Send exactly one of: mark_invoice_sent, mark_paid, or accounting_notes.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract, error: loadErr } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<ContractWithTotals>();

  if (loadErr || !contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'executed') {
    return NextResponse.json({ error: 'Accounting is only available for executed contracts.' }, { status: 409 });
  }

  const inv = (contract.invoice_status ?? 'pending') as InvoiceStatus;

  if (accounting_notes !== undefined) {
    const { error } = await supabase
      .from('contracts')
      .update({ accounting_notes: accounting_notes, updated_at: new Date().toISOString() })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  if (mark_invoice_sent) {
    if (inv !== 'pending') {
      return NextResponse.json({ error: 'Invoice can only be marked sent from pending state.' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('contracts')
      .update({
        invoice_status: 'invoice_sent',
        invoice_sent_at: now,
        invoice_sent_by: actor.email,
        updated_at: now,
      })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void notifySalesRepInvoiceSent({
      contractId: contract.id,
      companyName: contract.exhibitor_company_name,
      grandTotalCents: contract.grand_total_cents,
      sentAtLabel: formatTimestamp(now),
      salesRepId: contract.sales_rep_id,
    }).catch((e) => console.error('[notifySalesRepInvoiceSent]', e));

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  if (mark_paid) {
    if (inv !== 'invoice_sent') {
      return NextResponse.json({ error: 'Contract can only be marked paid from invoice_sent state.' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('contracts')
      .update({
        invoice_status: 'paid',
        paid_at: now,
        paid_by: actor.email,
        updated_at: now,
      })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void notifySalesRepInvoicePaid({
      contractId: contract.id,
      companyName: contract.exhibitor_company_name,
      salesRepId: contract.sales_rep_id,
    }).catch((e) => console.error('[notifySalesRepInvoicePaid]', e));

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported' }, { status: 400 });
}
