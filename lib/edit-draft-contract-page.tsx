import { notFound, redirect } from 'next/navigation';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import { dealKindFromContract } from '@/lib/contract-deal-kind';
import type { ContractLineItem, Event } from '@/types/db';
import {
  PRODUCT_WINE_SPECTATOR,
  productBasePath,
  productKeyFromEvent,
  scopeEventsByProduct,
} from '@/lib/product-portal';
import { actorCanUseNoChargeBooth, getStephenSenatoreRepId, noChargeMustAssignStephenRep } from '@/lib/no-charge-booth';

export const dynamic = 'force-dynamic';

export async function EditDraftContractPage({
  params,
  portalBasePath = '',
}: {
  params: { id: string };
  portalBasePath?: string;
}) {
  const viewed = await getContractWithTotalsForViewer(params.id);
  if (!viewed) notFound();
  const canEditVoided =
    viewed.contract.status === 'voided' && (viewed.actor.isAdmin || viewed.actor.isEventsTeam);
  const canEditCancelled =
    viewed.contract.status === 'cancelled' && (viewed.actor.isAdmin || viewed.actor.isEventsTeam);
  const canEditImported =
    isLegacyImportedContract(viewed.contract) &&
    (viewed.contract.status === 'imported' || viewed.contract.status === 'pending_events_review') &&
    (viewed.actor.isAdmin || viewed.actor.isEventsTeam);
  if (viewed.contract.status !== 'draft' && !canEditImported && !canEditVoided && !canEditCancelled) notFound();

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  const c = viewed.contract;
  const { data: contractEvent } = await supabase.from('events').select('*').eq('id', c.event_id).single();
  const productKey = productKeyFromEvent((contractEvent ?? null) as Event | null);
  const expectedPortalBase = productBasePath(productKey);

  if (productKey === PRODUCT_WINE_SPECTATOR && portalBasePath !== '/wine-spectator') {
    redirect(`${expectedPortalBase}/contracts/${params.id}/edit`);
  }
  if (productKey !== PRODUCT_WINE_SPECTATOR && portalBasePath === '/wine-spectator') {
    redirect(`${expectedPortalBase}/contracts/${params.id}/edit`);
  }

  const scopedEvents = scopeEventsByProduct((events ?? []) as Event[], productKey);

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

  const [canUseNoChargeBooth, stephenRepId, noChargeEnforceStephenRep] = await Promise.all([
    actorCanUseNoChargeBooth(viewed.actor.email),
    getStephenSenatoreRepId(),
    noChargeMustAssignStephenRep(viewed.actor.email),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <NewContractForm
        events={scopedEvents}
        portalBasePath={portalBasePath}
        currentUserEmail={viewed.actor.email}
        isAdmin={viewed.actor.isAdmin}
        editContractId={c.id}
        editImportMode={isLegacyImportedContract(c)}
        initialLineItems={initialLineItems}
        initialValues={{
          event_id: c.event_id,
          exhibitor_legal_name: c.exhibitor_legal_name,
          exhibitor_company_name: c.exhibitor_company_name,
          sponsor_brand: c.brands_poured ?? '',
          booth_count: c.booth_count,
          booth_rate_cents: c.booth_rate_cents,
          signer_1_name: c.signer_1_name ?? '',
          signer_1_title: c.signer_1_title ?? '',
          signer_1_email: c.signer_1_email ?? '',
          signer_cc_name: c.signer_cc_name ?? '',
          signer_cc_email: c.signer_cc_email ?? '',
          sales_rep_id: c.sales_rep_id ?? '',
          exhibitor_notes: c.exhibitor_notes ?? '',
          notes: c.notes ?? '',
          billing_contact_name: c.billing_contact_name ?? '',
          billing_contact_email: c.billing_contact_email ?? '',
          billing_address_line1: c.billing_address_line1 ?? '',
          billing_address_line2: c.billing_address_line2 ?? '',
          billing_city: c.billing_city ?? '',
          billing_state: c.billing_state ?? '',
          billing_zip: c.billing_zip ?? '',
          billing_country: c.billing_country ?? '',
        }}
        initialDealKind={dealKindFromContract(c)}
        initialBoothBrands={
          (boothBrandRows ?? []) as {
            booth_index: number;
            brand_name: string;
            brand_category?: string | null;
            expressions: string[];
          }[]
        }
        canUseNoChargeBooth={canUseNoChargeBooth}
        noChargeEnforceStephenRep={noChargeEnforceStephenRep}
        stephenRepId={stephenRepId}
        initialNoChargeBooth={Boolean(c.no_charge_booth)}
      />
    </div>
  );
}

