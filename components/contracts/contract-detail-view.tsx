'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { standardBoothRateCentsForEvent } from '@/lib/contracts';
import { isNyweVendorEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import {
  INTERNAL_CONTRACT_NOTES_LABEL,
  SPONSOR_CONTRACT_NOTES_LABEL,
} from '@/lib/contract-notes-copy';
import { dealKindLabel, type ContractDealKind } from '@/lib/contract-deal-kind';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { contractHasBillingInfo } from '@/lib/nywe-billing';
import { cn, formatCurrency, formatLongDate, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SignerContactEdit } from '@/components/contracts/signer-contact-edit';
import { ContractDetailHeader } from '@/components/contracts/contract-detail-header';
import { ContractProgressionTimeline } from '@/components/contract/progression-timeline';
import { ContractActions } from '@/components/contracts/contract-actions';
import { ActivityTimeline } from '@/components/contracts/activity-timeline';
import { PdfPreview } from '@/components/contracts/pdf-preview';
import { ContractLiveProvider } from '@/components/contracts/contract-live-context';
import { ContractDetailRealtime } from '@/components/contracts/contract-detail-realtime';
import { ContractTableOfContents } from '@/components/contracts/table-of-contents';
import { ContractActivityLogger } from '@/components/contracts/contract-activity-logger';
import { ContractSummarySection } from '@/components/contract/contract-summary-section';
import type {
  AuditLogEntry,
  ContractBoothBrand,
  ContractLineItem,
  ContractWithTotals,
  Event,
} from '@/types/db';

export type ContractDetailViewProps = {
  portalBasePath: string;
  contractsListHref: string;
  dashboardLinkHref: string;
  contract: ContractWithTotals;
  event: Event | null;
  audit: AuditLogEntry[];
  activityTimeline: AuditLogEntry[];
  lineItems: ContractLineItem[];
  boothBrands: ContractBoothBrand[];
  isAdmin: boolean;
  isEventsTeam: boolean;
  clientSendEnabled: boolean;
  eventsManagedWorkflow: boolean;
  releaseAudit: AuditLogEntry | undefined;
  discountPending: boolean;
  dealKind: ContractDealKind;
  canEditContractNotes: boolean;
  hasInternalNotesOnly: boolean;
  showNotesSection: boolean;
  draftPdfHref: string | null;
  signedPdfHref: string | null;
  canInlinePdf: boolean;
  pdfPreviewUrl: string;
  pdfPreviewCaption: string;
  legacyPdfUrl: string | null;
};

/** Entire contract detail UI — client-only to avoid hydration crashes on corporate PCs. */
export function ContractDetailView({
  portalBasePath,
  contractsListHref,
  dashboardLinkHref,
  contract,
  event,
  audit,
  activityTimeline,
  lineItems,
  boothBrands,
  isAdmin,
  isEventsTeam,
  clientSendEnabled,
  eventsManagedWorkflow,
  releaseAudit,
  discountPending,
  dealKind,
  canEditContractNotes,
  hasInternalNotesOnly,
  showNotesSection,
  draftPdfHref,
  signedPdfHref,
  canInlinePdf,
  pdfPreviewUrl,
  pdfPreviewCaption,
  legacyPdfUrl,
}: ContractDetailViewProps) {
  const nyweLicense = isNyweVendorEvent(event);

  return (
    <ContractLiveProvider>
      <div className="space-y-6">
        <ContractDetailRealtime contractId={contract.id} />
        <div className="sticky top-0 z-30 -mx-4 border-b border-parchment-200/80 bg-parchment-50/95 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-parchment-50/85 md:-mx-6 md:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-muted-foreground">
            <Link href={contractsListHref} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All contracts
            </Link>
            <span className="text-border">/</span>
            <Link href={dashboardLinkHref} className="hover:text-foreground">
              Dashboard
            </Link>
          </div>
        </div>

        <ContractDetailHeader
          title={contract.exhibitor_company_name}
          subtitle={`${event?.name ?? 'WhiskyFest'} · ${event ? formatLongDate(event.event_date) : '—'}`}
          status={contract.status}
          boothCount={contract.booth_count}
          orderType={contract.order_type}
          lineItemsSubtotalCents={contract.line_items_subtotal_cents}
          totalCents={contract.grand_total_cents}
          salesRep={contract.sales_rep_name ?? contract.sales_rep_email ?? null}
          showSalesRep={!nyweLicense}
          vendorLicense={nyweLicense}
        />

        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden xl:block">
            <ContractTableOfContents
              items={[
                { id: 'overview', label: 'Overview' },
                { id: 'pricing', label: 'Pricing & Line Items' },
                { id: 'exhibitor-info', label: 'Exhibitor Info' },
                { id: 'activity', label: 'Activity Timeline' },
                { id: 'pdf-preview', label: 'PDF Preview' },
              ]}
            />
          </div>
          <div className="space-y-6">
            <div id="overview" className="rounded-lg border border-border/50 bg-bg-surface p-4 md:p-6">
              <p className="wf-label-caps mb-4 text-[0.6rem]">Progress</p>
              <ContractProgressionTimeline
                status={contract.status}
                audit={audit}
                importedAt={contract.imported_at}
              />
            </div>

            <ContractSummarySection contract={contract} event={event} />

            {contract.imported_at && (
              <div className="rounded-md border border-violet-300/80 bg-violet-50/95 p-4 text-violet-950">
                <p className="text-sm font-semibold">Imported from outside the system</p>
                <p className="mt-1 text-sm text-violet-950/90">
                  This agreement was entered manually (paper or prior DocuSign).
                  {contract.originally_signed_at && (
                    <> Originally signed {formatLongDate(contract.originally_signed_at)}.</>
                  )}
                  {contract.imported_by && (
                    <>
                      {' '}
                      Imported by {contract.imported_by}
                      {contract.imported_at ? ` · ${formatTimestamp(contract.imported_at)}` : ''}.
                    </>
                  )}
                </p>
              </div>
            )}

            {!canInlinePdf && (
              <section className="space-y-2">
                <p className="wf-label-caps text-[0.6rem]">Contract PDF</p>
                <p className="text-sm text-muted-foreground">No PDF available yet. Generate Draft PDF first.</p>
              </section>
            )}

            {contract.status === 'cancelled' && contract.cancelled_reason && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">Contract cancelled</p>
                <p className="mt-1 text-sm text-foreground/80">{contract.cancelled_reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cancelled {formatTimestamp(contract.cancelled_at)}
                  {contract.cancelled_by && ` by ${contract.cancelled_by}`}
                </p>
              </div>
            )}

            {discountPending && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
                <p className="text-sm font-semibold">⚠ Discounted rate pending admin approval</p>
                <p className="mt-1 text-sm">
                  Booth rate: {formatCurrency(contract.booth_rate_cents)} is below the{' '}
                  {formatCurrency(standardBoothRateCentsForEvent(event))} standard. This contract is paused until an admin approves
                  the discount.
                </p>
                {!isAdmin && (
                  <p className="mt-2 text-xs text-amber-800">Contact an admin to approve this discount.</p>
                )}
              </div>
            )}

            {contract.status === 'draft' && contract.events_sent_back_at && (
              <div className="rounded-md border border-destructive/35 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold text-destructive">⚠ Sent back for changes</p>
                <p className="mt-1 text-foreground/90">
                  By {contract.events_sent_back_by ?? 'events team'}{' '}
                  {contract.events_sent_back_at ? `· ${formatTimestamp(contract.events_sent_back_at)}` : ''}
                </p>
                {contract.events_sent_back_reason && (
                  <p className="mt-2 whitespace-pre-wrap text-foreground/85">{contract.events_sent_back_reason}</p>
                )}
              </div>
            )}

            {contract.status === 'pending_events_review' && (
              <div className="rounded-md border border-sky-300 bg-sky-50 p-4 text-sky-950">
                {isEventsTeam ? (
                  <>
                    <p className="text-sm font-semibold">Pending your team&apos;s review</p>
                    <p className="mt-1 text-sm">
                      Submitted by {contract.created_by ?? '—'}.
                      {contract.events_submitted_at && (
                        <> · Submitted {formatTimestamp(contract.events_submitted_at)}</>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">⏳ Submitted for events review</p>
                    <p className="mt-1 text-sm">
                      {contract.events_submitted_at
                        ? `${formatTimestamp(contract.events_submitted_at)} — awaiting approval from the events team.`
                        : 'Awaiting approval from the events team.'}
                    </p>
                  </>
                )}
              </div>
            )}

            {contract.status === 'approved' && contract.events_approved_at && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
                <p className="text-sm font-semibold">✓ Approved by events team</p>
                <p className="mt-1 text-sm">
                  {contract.events_approved_by && <>By {contract.events_approved_by} · </>}
                  {formatTimestamp(contract.events_approved_at)}
                </p>
                {contract.events_approval_reason && (
                  <p className="mt-2 text-sm opacity-90">{contract.events_approval_reason}</p>
                )}
                <p className="mt-2 text-xs text-emerald-900/80">
                  {clientSendEnabled
                    ? 'Ready to send via DocuSign.'
                    : 'Approved internally — client send is disabled for this event.'}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-parchment-200/90 bg-parchment-50/80 p-4 shadow-sm">
              <ContractActions
                contractId={contract.id}
                exhibitorName={contract.exhibitor_company_name}
                signerEmail={contract.signer_1_email}
                signerName={contract.signer_1_name}
                status={contract.status}
                draftPdfHref={draftPdfHref}
                signedPdfHref={signedPdfHref}
                docusignEnvelopeId={contract.docusign_envelope_id}
                sentAt={contract.sent_at}
                updatedAt={contract.updated_at}
                executedAt={contract.executed_at}
                cancelledReason={contract.cancelled_reason}
                cancelledAt={contract.cancelled_at}
                cancelledBy={contract.cancelled_by}
                errorDetails={contract.notes}
                isAdmin={isAdmin}
                releasedBy={releaseAudit?.actor_email ?? null}
                releasedAt={releaseAudit?.occurred_at ?? null}
                boothCount={contract.booth_count}
                boothRateCents={contract.booth_rate_cents}
                grandTotalCents={contract.grand_total_cents}
                boothSubtotalCents={contract.booth_subtotal_cents}
                lineItemsSubtotalCents={contract.line_items_subtotal_cents ?? 0}
                salesRep={contract.sales_rep_name ?? contract.sales_rep_email ?? null}
                salesRepEmail={contract.sales_rep_email ?? null}
                countersignerName={event?.shanken_signatory_name ?? null}
                countersignerEmail={event?.shanken_signatory_email ?? null}
                createdBy={contract.created_by}
                discountApprovalPending={discountPending}
                isEventsTeam={isEventsTeam}
                eventsManagedWorkflow={eventsManagedWorkflow}
                clientSendEnabled={clientSendEnabled}
                importedAt={contract.imported_at}
              />
            </div>

            <hr className="my-2 border-parchment-300" />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card id="exhibitor-info">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-6 py-4">
                  <h2 className="font-serif text-lg font-semibold">Exhibitor</h2>
                  {isAdmin &&
                    (contract.status === 'approved' ||
                      contract.status === 'ready_for_review' ||
                      contract.status === 'pending_events_review') && (
                      <SignerContactEdit
                        contractId={contract.id}
                        initialName={contract.signer_1_name}
                        initialTitle={contract.signer_1_title}
                        initialEmail={contract.signer_1_email}
                        initialCcName={contract.signer_cc_name}
                        initialCcEmail={contract.signer_cc_email}
                        includeTitle={!isNyweVendorEvent(event)}
                      />
                    )}
                </div>
                <CardContent className="space-y-4 p-6 text-sm">
                  <div className="rounded-md border border-border/60 bg-muted/25 p-4">
                    <p className="wf-label-caps mb-3 text-[0.65rem] text-muted-foreground">Exhibitor signer</p>
                    <div className="space-y-2.5">
                      <Detail label="Name" value={contract.signer_1_name?.trim() || null} />
                      {!isNyweVendorEvent(event) ? (
                        <Detail label="Title" value={contract.signer_1_title?.trim() || null} />
                      ) : null}
                      <Detail
                        label="Signer email"
                        value={
                          contract.signer_1_email?.trim() ? (
                            <a
                              href={`mailto:${contract.signer_1_email.trim()}`}
                              title={contract.signer_1_email.trim()}
                              className="block truncate font-medium text-foreground underline decoration-primary underline-offset-2 transition-colors hover:text-primary"
                            >
                              {contract.signer_1_email.trim()}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        }
                      />
                      {contract.signer_cc_email?.trim() ? (
                        <Detail
                          label="DocuSign CC"
                          value={`${contract.signer_cc_name?.trim() || 'Assistant'} · ${contract.signer_cc_email.trim()}`}
                          mono
                        />
                      ) : null}
                    </div>
                  </div>
                  <Detail label="Legal Name" value={contract.exhibitor_legal_name} />
                  <Detail label="Display Name" value={contract.exhibitor_company_name} />
                  {!nyweLicense && boothBrands.length > 0 ? (
                    <section aria-labelledby="brands-expressions-heading">
                      <h3
                        id="brands-expressions-heading"
                        className="font-serif text-xl font-semibold tracking-tight text-foreground"
                      >
                        Brands &amp; Expressions
                      </h3>
                      <div className="mt-4 space-y-3">
                        {boothBrands.map((b) => (
                          <Card key={b.id} className="border-border/70 bg-parchment-50/80 shadow-none dark:bg-card">
                            <CardContent className="space-y-2 p-4">
                              <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Booth {b.booth_index}
                              </p>
                              <p className="font-serif text-lg font-semibold text-foreground">
                                {b.brand_name.trim() || '—'}
                              </p>
                              {b.expressions && b.expressions.length > 0 ? (
                                <div>
                                  <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                    Expressions
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {b.expressions.map((exp, ei) => (
                                      <span
                                        key={`${b.id}-${ei}-${exp}`}
                                        className="rounded-md bg-parchment-100 px-2 py-1 text-xs text-foreground dark:bg-muted"
                                      >
                                        {exp}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  ) : !nyweLicense ? (
                    <Detail label="Brands" value={contract.brands_poured} />
                  ) : contract.brands_poured ? (
                    <Detail label="Wine" value={contract.brands_poured} />
                  ) : null}
                  {!nyweLicense ? (
                    <Detail label="Sales Rep" value={contract.sales_rep_name ?? contract.sales_rep_email ?? '—'} />
                  ) : null}
                  {(contract.status === 'signed' || contract.status === 'executed') &&
                    contract.countersigned_at &&
                    (contract.countersigned_by_name || contract.countersigned_by_email) && (
                      <Detail
                        label="Countersigned (Shanken)"
                        value={`Countersigned by ${contract.countersigned_by_name ?? contract.countersigned_by_email ?? '—'} on ${formatTimestamp(contract.countersigned_at)}`}
                      />
                    )}
                </CardContent>
              </Card>

              <Card id="pricing">
                <div className="border-b border-border/50 px-6 py-4">
                  <h2 className="font-serif text-lg font-semibold">Pricing</h2>
                </div>
                <CardContent className="space-y-3 p-6 text-sm">
                  {!nyweLicense ? (
                    <Detail label="Deal type" value={dealKindLabel(dealKind)} />
                  ) : null}
                  {isSponsorshipOnlyOrder(contract) ? (
                    <>
                      <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Sponsorship only</p>
                      <Detail label="Package" value="No booth — line items only" />
                      {contract.brands_poured ? (
                        <Detail label="Sponsor / brand" value={contract.brands_poured} />
                      ) : null}
                    </>
                  ) : isNyweVendorEvent(event) ? (
                    <>
                      <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Vendor license</p>
                      <Detail
                        label="License fee"
                        value={formatCurrency(nyweLicenseFeeCents(event ?? undefined))}
                        mono
                      />
                      {contract.brands_poured ? (
                        <Detail label="Wine / brand" value={contract.brands_poured} />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Booth Package</p>
                      <Detail label="Booth count" value={String(contract.booth_count)} />
                      <Detail label="Rate per booth" value={formatCurrency(contract.booth_rate_cents)} mono />
                      <Detail label="Booth subtotal" value={formatCurrency(contract.booth_subtotal_cents)} mono />
                    </>
                  )}
                  {lineItems.length > 0 && (
                    <div className="border-t border-border/50 pt-4">
                      <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Line Items</p>
                      <Table className="mt-3">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((li) => (
                            <TableRow key={li.id}>
                              <TableCell className="max-w-[14rem] text-foreground">{li.description}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatCurrency(li.amount_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-3 flex justify-between border-t border-border/40 pt-2 text-sm font-medium">
                        <span>Line items subtotal</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(contract.line_items_subtotal_cents ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-border/50 pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-base font-semibold">Contract total</span>
                      <span className="font-mono text-lg font-semibold tabular-nums text-fest-900">
                        {formatCurrency(contract.grand_total_cents)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <div className="border-b border-border/50 px-6 py-4">
                  <h2 className="font-serif text-lg font-semibold">Exhibitor-provided information</h2>
                </div>
                <CardContent className="p-6 text-sm">
                  <ExhibitorProvidedInformationSection contract={contract} />
                </CardContent>
              </Card>
            </div>

            {showNotesSection ? (
              <Card>
                <div className="border-b border-border/50 px-6 py-4">
                  <h2 className="font-serif text-lg font-semibold">Contract notes</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Program terms print on the PDF under <span className="font-medium">Program terms &amp; benefits</span>.
                    Internal notes never go to the sponsor.
                  </p>
                </div>
                <CardContent className="space-y-4 p-6 text-sm">
                  {hasInternalNotesOnly ? (
                    <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-950">
                      <p className="font-medium">Sponsor-visible terms are empty</p>
                      <p className="mt-1 text-sm">
                        This contract has internal notes only. Move deal details the client should see into{' '}
                        <span className="font-medium">{SPONSOR_CONTRACT_NOTES_LABEL}</span>, then regenerate the PDF.
                      </p>
                      {canEditContractNotes ? (
                        <Link
                          href={`${portalBasePath}/contracts/${contract.id}/edit`}
                          className="mt-2 inline-block text-sm font-medium text-amber-900 underline underline-offset-2"
                        >
                          Edit contract notes
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                  {contract.exhibitor_notes?.trim() ? (
                    <div className="rounded-md border border-whisky-200/60 bg-whisky-50/30 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {SPONSOR_CONTRACT_NOTES_LABEL}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-foreground">{contract.exhibitor_notes}</p>
                    </div>
                  ) : canEditContractNotes && !contract.imported_at ? (
                    <div className="rounded-md border border-dashed border-border px-4 py-3 text-muted-foreground">
                      <p>No program terms added yet.</p>
                      <Link
                        href={`${portalBasePath}/contracts/${contract.id}/edit`}
                        className="mt-1 inline-block text-sm font-medium text-foreground underline underline-offset-2"
                      >
                        Add program terms &amp; benefits
                      </Link>
                    </div>
                  ) : null}
                  {contract.notes && contract.status !== 'error' ? (
                    <div className={contract.exhibitor_notes?.trim() ? 'border-t border-border/50 pt-4' : undefined}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {INTERNAL_CONTRACT_NOTES_LABEL}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{contract.notes}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <hr className="my-2 border-parchment-300" />

            <ContractActivityLogger contractId={contract.id} />
            <section id="activity" className="space-y-4">
              <p className="wf-label-caps text-[0.6rem] text-ink-500">Activity Timeline</p>
              <p className="font-sans text-xs text-muted-foreground">
                Creation, reviews, DocuSign signing, views, accounting steps, and other changes — newest at the bottom.
              </p>
              <ActivityTimeline audit={activityTimeline} />
            </section>

            {canInlinePdf ? (
              <>
                <hr className="my-2 border-parchment-300" />
                <section id="pdf-preview" className="space-y-4">
                  <p className="wf-label-caps text-[0.6rem] text-ink-500">Inline PDF Preview</p>
                  <PdfPreview fileUrl={pdfPreviewUrl} caption={pdfPreviewCaption} />
                  {legacyPdfUrl ? (
                    <p className="font-sans text-xs text-muted-foreground">
                      <a
                        href={legacyPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 underline-offset-4 hover:underline"
                      >
                        Open legacy Google Drive PDF
                      </a>
                    </p>
                  ) : null}
                </section>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </ContractLiveProvider>
  );
}

const EXHIBITOR_PROVIDED_PLACEHOLDER =
  'This information will be collected from the exhibitor at signing.';

function mailtoClass() {
  return 'text-foreground underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary';
}

function ExhibitorProvidedInformationSection({ contract }: { contract: ContractWithTotals }) {
  const captured = Boolean(contract.exhibitor_fields_captured_at);
  const legacyRepMailing =
    !captured &&
    Boolean(
      contract.exhibitor_address_line1?.trim() ||
        contract.exhibitor_city?.trim() ||
        contract.exhibitor_country?.trim(),
    );
  const legacyRepBilling =
    !captured &&
    (contractHasBillingInfo(contract) ||
      (contract.billing_same_as_corporate === false &&
        Boolean(contract.billing_address_line1?.trim() || contract.billing_city?.trim())));
  const legacyPhone = !captured && Boolean(contract.exhibitor_telephone?.trim());
  const hasLegacy = legacyRepMailing || legacyRepBilling || legacyPhone;

  if (captured) {
    const billEmail = contract.billing_contact_email?.trim();
    const evEmail = contract.event_contact_email?.trim();
    return (
      <div className="space-y-6">
        <div>
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Mailing address</p>
          <Detail label="Corporate / mailing" value={formatExhibitorAddressBlock(contract) || '—'} multiline />
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Telephone</p>
          <Detail label="Phone" value={contract.exhibitor_telephone?.trim() || '—'} />
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Billing</p>
          <div className="space-y-3">
            <Detail label="Contact name" value={contract.billing_contact_name?.trim() || '—'} />
            <Detail
              label="Contact email"
              value={
                billEmail ? (
                  <a href={`mailto:${billEmail}`} className={mailtoClass()}>
                    {billEmail}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Detail label="Billing address" value={formatBillingAddressBlock(contract)} multiline />
          </div>
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Event contact</p>
          <div className="space-y-3">
            <Detail
              label="Name"
              value={contract.event_contact_name?.trim() ? contract.event_contact_name.trim() : 'Not provided'}
            />
            <Detail
              label="Email"
              value={
                evEmail ? (
                  <a href={`mailto:${evEmail}`} className={mailtoClass()}>
                    {evEmail}
                  </a>
                ) : (
                  'Not provided'
                )
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (hasLegacy) {
    const billEmail = contract.billing_contact_email?.trim();
    const evEmail = contract.event_contact_email?.trim();
    return (
      <div className="space-y-6">
        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
          Billing details were saved from the exhibitor roster or entered on the license; DocuSign signing does not
          re-collect them for NYWE vendor licenses.
        </p>
        <div>
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Mailing address</p>
          <Detail
            label="Corporate / mailing"
            value={legacyRepMailing ? formatExhibitorAddressBlock(contract) || '—' : '—'}
            multiline
          />
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Telephone</p>
          <Detail
            label="Phone"
            value={legacyPhone && contract.exhibitor_telephone?.trim() ? contract.exhibitor_telephone.trim() : '—'}
          />
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Billing</p>
          <div className="space-y-3">
            <Detail label="Contact name" value={contract.billing_contact_name?.trim() || '—'} />
            <Detail
              label="Contact email"
              value={
                billEmail ? (
                  <a href={`mailto:${billEmail}`} className={mailtoClass()}>
                    {billEmail}
                  </a>
                ) : (
                  '—'
                )
              }
            />
            <Detail
              label="Billing address"
              value={legacyRepBilling ? formatBillingAddressBlock(contract) || '—' : '—'}
              multiline
            />
          </div>
        </div>
        <div className="border-t border-border/50 pt-6">
          <p className="wf-label-caps mb-2 text-[0.6rem] text-muted-foreground">Event contact</p>
          <div className="space-y-3">
            <Detail
              label="Name"
              value={contract.event_contact_name?.trim() ? contract.event_contact_name.trim() : 'Not provided'}
            />
            <Detail
              label="Email"
              value={
                evEmail ? (
                  <a href={`mailto:${evEmail}`} className={mailtoClass()}>
                    {evEmail}
                  </a>
                ) : (
                  'Not provided'
                )
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return <p className="text-muted-foreground">{EXHIBITOR_PROVIDED_PLACEHOLDER}</p>;
}

function Detail({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  multiline?: boolean;
}) {
  const empty =
    value == null || value === false || (typeof value === 'string' && value.trim() === '');
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 text-right',
          mono && 'font-mono tabular-nums',
          multiline && 'max-w-[min(100%,20rem)] whitespace-pre-wrap text-right text-sm leading-snug',
          !multiline && 'truncate',
        )}
      >
        {empty ? '—' : value}
      </span>
    </div>
  );
}
