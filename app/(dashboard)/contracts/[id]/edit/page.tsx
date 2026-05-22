import { notFound } from 'next/navigation';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { ContractLineItem, Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function EditDraftContractPage({ params }: { params: { id: string } }) {
  const viewed = await getContractWithTotalsForViewer(params.id);
  if (!viewed) notFound();
  const canEditVoided =
    viewed.contract.status === 'voided' && (viewed.actor.isAdmin || viewed.actor.isEventsTeam);
  const canEditImported =
    viewed.contract.status === 'imported' && (viewed.actor.isAdmin || viewed.actor.isEventsTeam);
  if (viewed.contract.status !== 'draft' && !canEditImported && !canEditVoided) notFound();

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  const c = viewed.contract;

  const [{ data: lineItemRows }, { data: boothBrandRows }] = await Promise.all([
    supabase
      .from('contract_line_items')
      .select('description, amount_cents')
      .eq('contract_id', c.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('contract_booth_brands')
      .select('booth_index, brand_name, brand_category, expressions')
      .eq('contract_id', c.id)
      .order('booth_index', { ascending: true }),
  ]);

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
        editImportMode={c.status === 'imported'}
        initialLineItems={initialLineItems}
        initialValues={{
          event_id: c.event_id,
          exhibitor_legal_name: c.exhibitor_legal_name,
          exhibitor_company_name: c.exhibitor_company_name,
          booth_count: c.booth_count,
          booth_rate_cents: c.booth_rate_cents,
          signer_1_name: c.signer_1_name ?? '',
          signer_1_title: c.signer_1_title ?? '',
          signer_1_email: c.signer_1_email ?? '',
          sales_rep_id: c.sales_rep_id ?? '',
          notes: c.notes ?? '',
        }}
        initialBoothBrands={
          (boothBrandRows ?? []) as {
            booth_index: number;
            brand_name: string;
            brand_category?: string | null;
            expressions: string[];
          }[]
        }
      />
    </div>
  );
}
