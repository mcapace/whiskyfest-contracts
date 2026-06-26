import { notFound, redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { requiresDiscountApproval } from '@/lib/contracts';
import { isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { isNyweVendorEvent } from '@/lib/nywe-pricing';
import { dealKindFromContract } from '@/lib/contract-deal-kind';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { ContractDetailViewClient } from '@/lib/contract-detail-client';
import { buildContractActivityTimeline } from '@/lib/contract-activity-timeline';
import {
  contractPdfPreviewUrl,
  contractPdfPreviewVersion,
  contractPrefersSignedPdf,
} from '@/lib/contract-pdf-preview';
import { syncDraftPdfFromDocuSign } from '@/lib/contract-pdf-sync-docusign';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import {
  detectLinkedRosterDrift,
  refreshContractFromLinkedRoster,
} from '@/lib/nywe-roster-contract-sync';
import type {
  AuditLogEntry,
  ContractBoothBrand,
  ContractLineItem,
  ContractWithTotals,
  Event,
} from '@/types/db';
import {
  PRODUCT_WINE_SPECTATOR,
  contractDetailHref,
  dashboardHref,
  productKeyFromEvent,
} from '@/lib/product-portal';
import { wineSpectatorContractIsAdmin } from '@/lib/wine-spectator-access';

export const dynamic = 'force-dynamic';

async function loadAudit(contractId: string): Promise<AuditLogEntry[]> {
  const supabase = getSupabaseAdmin();
  const { data: audit } = await supabase
    .from('audit_log')
    .select('*')
    .eq('contract_id', contractId)
    .order('occurred_at', { ascending: false });
  return (audit ?? []) as AuditLogEntry[];
}

export async function ContractDetailPage({
  params,
  portalBasePath = '',
}: {
  params: { id: string };
  portalBasePath?: string;
}) {
  const viewed = await getContractWithTotalsForViewer(params.id);
  if (!viewed) notFound();

  const { contract: loadedContract, actor } = viewed;
  let contract = loadedContract;
  const supabase = getSupabaseAdmin();
  const [{ data: event }, auditInitial, { data: lineItemsRows }, { data: boothBrandRows }] = await Promise.all([
    supabase.from('events').select('*').eq('id', contract.event_id).single(),
    loadAudit(contract.id),
    supabase
      .from('contract_line_items')
      .select('*')
      .eq('contract_id', contract.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('contract_booth_brands')
      .select('*')
      .eq('contract_id', contract.id)
      .order('booth_index', { ascending: true }),
  ]);

  const lineItems = (lineItemsRows ?? []) as ContractLineItem[];
  const boothBrands = (boothBrandRows ?? []) as ContractBoothBrand[];
  const eventRow = (event ?? null) as Event | null;
  const productKey = productKeyFromEvent(eventRow);

  if (productKey === PRODUCT_WINE_SPECTATOR && portalBasePath !== '/wine-spectator') {
    redirect(contractDetailHref(PRODUCT_WINE_SPECTATOR, params.id));
  }
  if (productKey !== PRODUCT_WINE_SPECTATOR && portalBasePath === '/wine-spectator') {
    redirect(contractDetailHref(productKey, params.id));
  }

  const contractsListHref = `${portalBasePath}/contracts`;
  const dashboardLinkHref = dashboardHref(productKey);
  const clientSendEnabled = eventRow?.client_send_enabled !== false;
  const eventsManagedWorkflow = eventRow ? isEventsManagedWorkflow(eventRow) : false;
  const nyweSignedNeedsAccounting =
    eventsManagedWorkflow &&
    contract.status === 'signed' &&
    !contract.executed_at &&
    Boolean(contract.docusign_envelope_id);

  if (
    contract.docusign_envelope_id &&
    (['sent', 'partially_signed', 'error'].includes(contract.status) || nyweSignedNeedsAccounting)
  ) {
    try {
      const sync = await syncContractFromDocuSign(
        supabase,
        contract,
        (event ?? null) as Event | null,
        null,
        { notify: false },
      );
      if (sync.ok && sync.changed) {
        const { data: refreshed } = await supabase
          .from('contracts_with_totals')
          .select('*')
          .eq('id', contract.id)
          .maybeSingle<ContractWithTotals>();
        if (refreshed) contract = refreshed;
      }
    } catch (err) {
      console.error('[contract detail] DocuSign status sync failed', err);
    }
  }

  if (
    eventRow &&
    isNyweVendorEvent(eventRow) &&
    contract.source_sheet_id &&
    contract.source_sheet_tab &&
    contract.source_row_number
  ) {
    try {
      const rosterRefresh = await refreshContractFromLinkedRoster(supabase, contract, eventRow, {
        revalidate: false,
      });
      if (rosterRefresh.updated) {
        contract = rosterRefresh.contract;
      }
    } catch (err) {
      console.error('[contract detail] roster field sync failed', err);
    }
  }

  let rosterNeedsResend = false;
  let rosterDriftFields: string[] = [];
  if (eventRow && isNyweVendorEvent(eventRow) && contract.source_sheet_id) {
    try {
      const drift = await detectLinkedRosterDrift(contract, eventRow);
      rosterNeedsResend = drift.needsResend;
      rosterDriftFields = drift.fields;
    } catch (err) {
      console.error('[contract detail] roster drift check failed', err);
    }
  }

  const audit =
    contract !== loadedContract ? await loadAudit(contract.id) : (auditInitial ?? []);
  const activityTimeline = buildContractActivityTimeline(audit, contract);

  const isAdmin = wineSpectatorContractIsAdmin(productKey, {
    isAdmin: actor.isAdmin,
    isWineSpectatorAdmin: actor.isWineSpectatorAdmin,
  });
  const isEventsTeam = actor.isEventsTeam;
  const releaseAudit = audit.find((entry) => entry.action === 'released_to_accounting' || entry.action === 'executed');
  const discountPending = requiresDiscountApproval(contract, event ?? undefined);
  const dealKind = dealKindFromContract(contract);
  const legacyImport = isLegacyImportedContract(contract);
  const canEditContractNotes =
    contract.status === 'draft' ||
    (contract.status === 'voided' && (isAdmin || isEventsTeam)) ||
    (legacyImport &&
      (contract.status === 'imported' || contract.status === 'pending_events_review') &&
      (isAdmin || isEventsTeam));
  const hasInternalNotesOnly =
    !contract.exhibitor_notes?.trim() &&
    Boolean(contract.notes?.trim()) &&
    contract.status !== 'error';
  const showNotesSection =
    Boolean(contract.exhibitor_notes?.trim()) ||
    Boolean(contract.notes?.trim() && contract.status !== 'error') ||
    canEditContractNotes ||
    legacyImport;

  const legacyPdfUrl = contract.signed_pdf_url ?? contract.draft_pdf_url;
  const draftPdfHref =
    contract.drafted_at || contract.draft_pdf_url || contract.pdf_storage_path
      ? `/api/contracts/${contract.id}/pdf?variant=draft`
      : null;
  const signedPdfHref =
    contract.signed_pdf_url ||
    contract.signed_at ||
    contract.pdf_storage_path?.endsWith('signed.pdf')
      ? `/api/contracts/${contract.id}/pdf?variant=signed`
      : null;

  let contractForPreview = contract;
  if (contract.docusign_envelope_id) {
    try {
      const { synced, drafted_at } = await syncDraftPdfFromDocuSign(supabase, contract);
      if (synced && drafted_at) {
        contractForPreview = { ...contract, drafted_at, pdf_storage_path: `${contract.id}/draft.pdf` };
      }
    } catch (err) {
      console.error('[contract detail] DocuSign PDF preview sync failed', err);
    }
  }

  const hasPdfSource = Boolean(
    contractForPreview.drafted_at ||
      contractForPreview.draft_pdf_url ||
      contractForPreview.pdf_storage_path ||
      contractForPreview.signed_pdf_url ||
      contractForPreview.signed_at ||
      contract.docusign_envelope_id,
  );
  const canInlinePdf = hasPdfSource;
  const pdfPreviewVersion = contractPdfPreviewVersion(contractForPreview);
  const pdfPreviewUrl = contractPdfPreviewUrl(contract.id, pdfPreviewVersion);
  const pdfPreviewCaption = contractPrefersSignedPdf(contractForPreview.status)
    ? 'Signed agreement (latest stored copy)'
    : contract.status === 'sent' || contract.status === 'partially_signed'
      ? 'Draft sent to DocuSign (matches latest envelope)'
      : isNyweVendorEvent(eventRow)
        ? 'Live preview — billing address and signatory title from current data'
        : 'Latest generated draft';

  return (
    <ContractDetailViewClient
      portalBasePath={portalBasePath}
      contractsListHref={contractsListHref}
      dashboardLinkHref={dashboardLinkHref}
      contract={contract}
      event={eventRow}
      audit={audit}
      activityTimeline={activityTimeline}
      lineItems={lineItems}
      boothBrands={boothBrands}
      isAdmin={isAdmin}
      isEventsTeam={isEventsTeam}
      clientSendEnabled={clientSendEnabled}
      eventsManagedWorkflow={eventsManagedWorkflow}
      releaseAudit={releaseAudit}
      discountPending={discountPending}
      dealKind={dealKind}
      canEditContractNotes={canEditContractNotes}
      hasInternalNotesOnly={hasInternalNotesOnly}
      showNotesSection={showNotesSection}
      draftPdfHref={draftPdfHref}
      signedPdfHref={signedPdfHref}
      canInlinePdf={canInlinePdf}
      pdfPreviewUrl={pdfPreviewUrl}
      pdfPreviewCaption={pdfPreviewCaption}
      legacyPdfUrl={legacyPdfUrl}
      rosterNeedsResend={rosterNeedsResend}
      rosterDriftFields={rosterDriftFields}
    />
  );
}
