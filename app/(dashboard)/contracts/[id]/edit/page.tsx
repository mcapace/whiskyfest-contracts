import { notFound } from 'next/navigation';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { ContractLineItem, Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function EditDraftContractPage({ params }: { params: { id: string } }) {
  const viewed = await getContractWithTotalsForViewer(params.id);
  if (!viewed || viewed.contract.status !== 'draft') notFound();

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  const c = viewed.contract;

  const { data: lineItemRows } = await supabase
    .from('contract_line_items')
    .select('description, amount_cents')
    .eq('contract_id', c.id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  const initialLineItems = (lineItemRows ?? []).map((r) => {
    const row = r as Pick<ContractLineItem, 'description' | 'amount_cents'>;
    return { description: row.description, amount_cents: row.amount_cents };
  });

  return (
    <div className="max-w-3xl space-y-6">
      <NewContractForm
        events={(events ?? []) as Event[]}
        currentUserEmail={viewed.actor.email}
        isAdmin={viewed.actor.isAdmin}
        editContractId={c.id}
        initialLineItems={initialLineItems}
        initialValues={{
          event_id: c.event_id,
          exhibitor_legal_name: c.exhibitor_legal_name,
          exhibitor_company_name: c.exhibitor_company_name,
          brands_poured: c.brands_poured ?? '',
          booth_count: c.booth_count,
          booth_rate_cents: c.booth_rate_cents,
          signer_1_name: c.signer_1_name ?? '',
          signer_1_title: c.signer_1_title ?? '',
          signer_1_email: c.signer_1_email ?? '',
          sales_rep_id: c.sales_rep_id ?? '',
          notes: c.notes ?? '',
        }}
      />
    </div>
  );
}
