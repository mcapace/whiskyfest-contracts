import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canImportLegacyContracts, requireContractActorForPage } from '@/lib/auth-contract';
import { ImportContractForm } from '@/components/contracts/import-contract-form';
import {
  brandsTextToBoothBrandDrafts,
  canAccessParticipationReport,
} from '@/lib/participation-report-shared';
import { PRODUCT_WHISKYFEST, scopeEventsByProduct } from '@/lib/product-portal';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function ImportContractPage({
  searchParams,
}: {
  searchParams: { fromPipeline?: string };
}) {
  const actor = await requireContractActorForPage();
  if (!canImportLegacyContracts(actor)) {
    redirect(actor.isAccounting ? '/accounting' : '/contracts');
  }

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  const scopedEvents = scopeEventsByProduct((events ?? []) as Event[], PRODUCT_WHISKYFEST);

  let pipelineTargetId: string | undefined;
  let pipelineBanner: string | null = null;
  let initialValues:
    | {
        event_id: string;
        exhibitor_company_name: string;
        exhibitor_legal_name: string;
        booth_count: number;
        booth_rate_cents: number;
        sales_rep_id: string;
        notes: string;
      }
    | undefined;
  let initialBoothBrands:
    | { booth_index: number; brand_name: string; brand_category?: string | null; expressions: string[] }[]
    | undefined;

  const fromPipeline = searchParams.fromPipeline?.trim();
  if (fromPipeline) {
    if (!canAccessParticipationReport(actor.email)) {
      redirect('/contracts/import');
    }
    const { data: target } = await supabase
      .from('wf_pipeline_targets')
      .select('*')
      .eq('id', fromPipeline)
      .eq('is_active', true)
      .maybeSingle();

    if (target?.linked_contract_id) {
      redirect(`/contracts/${target.linked_contract_id}`);
    }

    if (target) {
      pipelineTargetId = target.id;
      const booths = Math.max(1, Number(target.booth_count) || 1);
      const rate =
        Number(target.rate_per_booth_cents) > 0
          ? Number(target.rate_per_booth_cents)
          : (scopedEvents.find((e) => e.id === target.event_id)?.booth_rate_cents ??
            scopedEvents[0]?.booth_rate_cents ??
            1_500_000);
      const noteParts = [
        target.section === 'pending_renewal'
          ? 'Imported from pending renewal (manual signed PDF)'
          : 'Imported from new business inquiry (manual signed PDF)',
        target.notes?.trim() || null,
      ].filter(Boolean);
      initialValues = {
        event_id: target.event_id,
        exhibitor_legal_name: target.company_name,
        exhibitor_company_name: target.company_name,
        booth_count: booths,
        booth_rate_cents: rate,
        sales_rep_id: target.sales_rep_id ?? '',
        notes: noteParts.join('\n\n'),
      };
      initialBoothBrands = brandsTextToBoothBrandDrafts(target.brands_text, booths);
      pipelineBanner =
        target.section === 'pending_renewal'
          ? `Importing signed PDF for pending renewal: ${target.company_name}`
          : `Importing signed PDF for new business: ${target.company_name}`;
    }
  }

  return (
    <ImportContractForm
      events={scopedEvents}
      currentUserEmail={actor.email}
      isAdmin={actor.isAdmin}
      isEventsTeam={actor.isEventsTeam}
      pipelineTargetId={pipelineTargetId}
      pipelineBanner={pipelineBanner}
      initialValues={initialValues}
      initialBoothBrands={initialBoothBrands}
    />
  );
}
