import { notFound } from 'next/navigation';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { Event } from '@/types/db';

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

  return (
    <div className="max-w-3xl space-y-6">
      <NewContractForm
        events={(events ?? []) as Event[]}
        currentUserEmail={viewed.actor.email}
        isAdmin={viewed.actor.isAdmin}
        editContractId={c.id}
        initialValues={{
          event_id: c.event_id,
          exhibitor_legal_name: c.exhibitor_legal_name,
          exhibitor_company_name: c.exhibitor_company_name,
          exhibitor_address_line1: c.exhibitor_address_line1 ?? '',
          exhibitor_address_line2: c.exhibitor_address_line2 ?? '',
          exhibitor_city: c.exhibitor_city ?? '',
          exhibitor_state: c.exhibitor_state ?? '',
          exhibitor_zip: c.exhibitor_zip ?? '',
          exhibitor_country: c.exhibitor_country ?? 'United States',
          exhibitor_telephone: c.exhibitor_telephone ?? '',
          brands_poured: c.brands_poured ?? '',
          booth_count: c.booth_count,
          booth_rate_cents: c.booth_rate_cents,
          signer_1_name: c.signer_1_name ?? '',
          signer_1_title: c.signer_1_title ?? '',
          signer_1_email: c.signer_1_email ?? '',
          sales_rep_id: c.sales_rep_id ?? '',
          notes: c.notes ?? '',
          billing_same_as_corporate: c.billing_same_as_corporate ?? true,
          billing_address_line1: c.billing_address_line1 ?? '',
          billing_address_line2: c.billing_address_line2 ?? '',
          billing_city: c.billing_city ?? '',
          billing_state: c.billing_state ?? '',
          billing_zip: c.billing_zip ?? '',
          billing_country: c.billing_country ?? 'United States',
        }}
      />
    </div>
  );
}
