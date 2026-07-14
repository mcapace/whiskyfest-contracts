import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { insertContractAudit } from '@/lib/audit-log';
import { notifySalesRepInvoicePaid, notifySalesRepInvoiceSent } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { syncBilledContractToGoogleSheet } from '@/lib/sheets-billed-export';
import { formatTimestamp } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { ContractWithTotals, InvoiceStatus } from '@/types/db';

export const runtime = 'nodejs';

const bodySchema = z.object({
  mark_invoice_sent: z.boolean().optional(),
  /** Undo accidental "invoice sent" — returns status to pending so AR can re-send or correct. */
  recall_invoice_sent: z.boolean().optional(),
  /** Permanently void a sent invoice (accounting/admin only). Requires reason. */
  void_invoice_sent: z.boolean().optional(),
  void_reason: z.string().trim().min(5).max(2000).optional(),
  /** Restore a voided invoice back to pending so AR can invoice again. */
  restore_voided_invoice: z.boolean().optional(),
  mark_paid: z.boolean().optional(),
  accounting_notes: z.string().max(20000).optional(),
});

async function requireAccountingActor() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const isAdmin = session.user.role === 'admin';
  const isAccounting = Boolean(session.user.is_accounting);
  if (!isAdmin && !isAccounting) return null;

  const eff = getEffectiveUserEmail(session);
  if (!eff) return null;

  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase.from('app_users').select('is_active').eq('email', eff).maybeSingle();

  if (!appUser?.is_active) return null;

  return { email: eff };
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

  const {
    mark_invoice_sent,
    recall_invoice_sent,
    void_invoice_sent,
    void_reason,
    restore_voided_invoice,
    mark_paid,
    accounting_notes,
  } = parsed.data;
  const ops = [
    mark_invoice_sent === true,
    recall_invoice_sent === true,
    void_invoice_sent === true,
    restore_voided_invoice === true,
    mark_paid === true,
    accounting_notes !== undefined,
  ].filter(Boolean);
  if (ops.length !== 1) {
    return NextResponse.json(
      {
        error:
          'Send exactly one of: mark_invoice_sent, recall_invoice_sent, void_invoice_sent, restore_voided_invoice, mark_paid, or accounting_notes.',
      },
      { status: 400 },
    );
  }

  if (void_invoice_sent && !void_reason?.trim()) {
    return NextResponse.json({ error: 'A void reason is required (at least 5 characters).' }, { status: 400 });
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
    if (inv === 'not_invoiced') {
      return NextResponse.json({ error: 'This contract is marked Do Not Invoice and cannot be invoiced.' }, { status: 409 });
    }
    if (inv !== 'pending' && inv !== 'invoice_voided') {
      return NextResponse.json(
        { error: 'Invoice can only be marked sent from pending or voided state.' },
        { status: 409 },
      );
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

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actor.email,
      action: 'invoice_marked_sent',
      metadata: {
        invoice_sent_at: now,
        from_status: inv,
        reissued_after_void: inv === 'invoice_voided',
      },
    });
    revalidateContractPaths(contract.id);

    void notifySalesRepInvoiceSent({
      contractId: contract.id,
      companyName: contract.exhibitor_company_name,
      grandTotalCents: contract.grand_total_cents,
      sentAtLabel: formatTimestamp(now),
      salesRepId: contract.sales_rep_id,
      eventId: contract.event_id,
      createdBy: contract.created_by,
    }).catch((e) => console.error('[notifySalesRepInvoiceSent]', e));

    void syncBilledContractToGoogleSheet(contract.id);

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  if (recall_invoice_sent) {
    if (inv !== 'invoice_sent') {
      return NextResponse.json(
        { error: 'Only invoices marked as sent can be recalled to pending.' },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('contracts')
      .update({
        invoice_status: 'pending',
        invoice_sent_at: null,
        invoice_sent_by: null,
        updated_at: now,
      })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actor.email,
      action: 'invoice_sent_recalled',
      metadata: {
        prior_invoice_sent_at: contract.invoice_sent_at,
        prior_invoice_sent_by: contract.invoice_sent_by,
      },
    });
    revalidateContractPaths(contract.id);

    // Full billed-sheet refresh so this contract is removed from "invoice sent" export.
    void syncBilledContractToGoogleSheet(contract.id);

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  if (void_invoice_sent) {
    if (inv !== 'invoice_sent') {
      return NextResponse.json(
        { error: 'Only invoices marked as sent can be voided.' },
        { status: 409 },
      );
    }
    const reason = void_reason!.trim();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('contracts')
      .update({
        invoice_status: 'invoice_voided',
        invoice_sent_at: null,
        invoice_sent_by: null,
        updated_at: now,
      })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actor.email,
      action: 'invoice_sent_voided',
      metadata: {
        reason,
        prior_invoice_sent_at: contract.invoice_sent_at,
        prior_invoice_sent_by: contract.invoice_sent_by,
      },
    });
    revalidateContractPaths(contract.id);

    void syncBilledContractToGoogleSheet(contract.id);

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  if (restore_voided_invoice) {
    if (inv !== 'invoice_voided') {
      return NextResponse.json(
        { error: 'Only voided invoices can be restored to pending.' },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('contracts')
      .update({
        invoice_status: 'pending',
        updated_at: now,
      })
      .eq('id', contract.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actor.email,
      action: 'invoice_voided_restored',
      metadata: {},
    });
    revalidateContractPaths(contract.id);

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

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actor.email,
      action: 'invoice_marked_paid',
      metadata: { paid_at: now },
    });
    revalidateContractPaths(contract.id);

    void notifySalesRepInvoicePaid({
      contractId: contract.id,
      companyName: contract.exhibitor_company_name,
      salesRepId: contract.sales_rep_id,
      eventId: contract.event_id,
      createdBy: contract.created_by,
    }).catch((e) => console.error('[notifySalesRepInvoicePaid]', e));

    void syncBilledContractToGoogleSheet(contract.id);

    revalidatePath('/accounting');
    revalidatePath(`/accounting/${contract.id}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported' }, { status: 400 });
}
