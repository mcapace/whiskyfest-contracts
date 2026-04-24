import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { requiresDiscountApproval, STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { formatStatus } from '@/lib/status-display';
import { createContractPdfSignedUrl } from '@/lib/contract-pdf-storage';
import { cn, formatCurrency, formatLongDate, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { ContractActions } from '@/components/contracts/contract-actions';
import { SignerContactEdit } from '@/components/contracts/signer-contact-edit';
import { ContractProgressionTimeline } from '@/components/contract/progression-timeline';
import { ContractSummarySection } from '@/components/contract/contract-summary-section';
import type { ContractLineItem, ContractWithTotals, Event, AuditLogEntry } from '@/types/db';

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

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const viewed = await getContractWithTotalsForViewer(params.id);
  if (!viewed) notFound();

  const { contract, actor } = viewed;
  const supabase = getSupabaseAdmin();
  const [{ data: event }, audit, { data: lineItemsRows }] = await Promise.all([
    supabase.from('events').select('*').eq('id', contract.event_id).single(),
    loadAudit(contract.id),
    supabase
      .from('contract_line_items')
      .select('*')
      .eq('contract_id', contract.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const lineItems = (lineItemsRows ?? []) as ContractLineItem[];

  const isAdmin = actor.isAdmin;
  const isEventsTeam = actor.isEventsTeam;
  const releaseAudit = audit.find((entry) => entry.action === 'released_to_accounting' || entry.action === 'executed');
  const discountPending = requiresDiscountApproval(contract);

  let pdfEmbedUrl: string | null = null;
  if (contract.pdf_storage_path) {
    try {
      pdfEmbedUrl = await createContractPdfSignedUrl(contract.pdf_storage_path);
    } catch {
      pdfEmbedUrl = null;
    }
  }

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

  return (
    <div className="space-y-6 pb-28 md:pb-32">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href="/contracts" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All contracts
        </Link>
        <span className="text-border">/</span>
        <Link href="/" className="hover:text-foreground">Dashboard</Link>
      </div>

      {/* Header — compact; summary panel carries display typography */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border/40 pb-4">
        <StatusBadge status={contract.status} />
        <span className="font-mono text-xs text-muted-foreground">{contract.id.slice(0, 8)}</span>
        {event && (
          <span className="text-sm text-muted-foreground">
            {event.name} · {formatLongDate(event.event_date)}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border/50 bg-bg-surface p-4 md:p-6">
        <p className="wf-label-caps mb-4 text-[0.6rem]">Progress</p>
        <ContractProgressionTimeline status={contract.status} audit={audit} />
      </div>

      <ContractSummarySection contract={contract} event={event ?? null} />

      {(pdfEmbedUrl || legacyPdfUrl) && (
        <section className="space-y-3">
          <p className="wf-label-caps text-[0.6rem]">Contract PDF</p>
          {pdfEmbedUrl ? (
            <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20 shadow-md">
              <iframe
                title={contract.signed_pdf_url ? 'Signed contract PDF' : 'Draft contract PDF'}
                src={pdfEmbedUrl}
                className="h-[800px] w-full rounded-lg border border-border/60 bg-background md:aspect-[8.5/11] md:h-auto"
              />
            </div>
          ) : legacyPdfUrl ? (
            <p className="text-sm text-muted-foreground">
              <a
                href={legacyPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent-brand underline-offset-4 hover:underline"
              >
                Open PDF (legacy Google Drive)
              </a>
            </p>
          ) : null}
          <a
            href={`/api/contracts/${contract.id}/pdf?variant=auto`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block font-mono text-sm text-accent-brand underline-offset-4 hover:underline"
          >
            Download PDF
          </a>
        </section>
      )}

      {!pdfEmbedUrl && !legacyPdfUrl && (
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
            Booth rate: {formatCurrency(contract.booth_rate_cents)} is below the {formatCurrency(STANDARD_BOOTH_RATE_CENTS)} standard.
            This contract is paused until an admin approves the discount.
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
                  <>
                    {' '}
                    · Submitted {formatTimestamp(contract.events_submitted_at)}
                  </>
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
          <p className="mt-2 text-xs text-emerald-900/80">Ready to send via DocuSign.</p>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
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
            lineItemsSubtotalCents={contract.line_items_total_cents ?? 0}
            salesRep={contract.sales_rep_name ?? contract.sales_rep_email ?? null}
            salesRepEmail={contract.sales_rep_email ?? null}
            countersignerName={event?.shanken_signatory_name ?? null}
            countersignerEmail={event?.shanken_signatory_email ?? null}
            createdBy={contract.created_by}
            discountApprovalPending={discountPending}
            isEventsTeam={isEventsTeam}
          />
        </CardContent>
      </Card>

      {/* Two-column details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exhibitor */}
        <Card>
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
                initialAddressLine1={contract.exhibitor_address_line1}
                initialAddressLine2={contract.exhibitor_address_line2}
                initialCity={contract.exhibitor_city}
                initialState={contract.exhibitor_state}
                initialZip={contract.exhibitor_zip}
                initialCountry={contract.exhibitor_country}
              />
            )}
          </div>
          <CardContent className="space-y-3 p-6 text-sm">
            <Detail label="Legal Name"   value={contract.exhibitor_legal_name} />
            <Detail label="Display Name" value={contract.exhibitor_company_name} />
            <Detail label="Address" value={formatExhibitorAddressBlock(contract)} multiline />
            {contract.billing_same_as_corporate === false && (
              <Detail label="Billing Address" value={formatBillingAddressBlock(contract)} multiline />
            )}
            <Detail label="Telephone"    value={contract.exhibitor_telephone} />
            <Detail label="Brands"       value={contract.brands_poured} />
            <Detail label="Sales Rep"    value={contract.sales_rep_name ?? contract.sales_rep_email ?? '—'} />
            <Detail label="Signer"       value={[contract.signer_1_name, contract.signer_1_title].filter(Boolean).join(', ') || '—'} />
            <Detail label="Email (DocuSign to exhibitor)" value={contract.signer_1_email} mono />
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

        {/* Pricing */}
        <Card>
          <div className="border-b border-border/50 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">Pricing</h2>
          </div>
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Booth Package</p>
            <Detail label="Booth count" value={String(contract.booth_count)} />
            <Detail label="Rate per booth" value={formatCurrency(contract.booth_rate_cents)} mono />
            <Detail label="Booth subtotal" value={formatCurrency(contract.booth_subtotal_cents)} mono />
            {lineItems.length > 0 && (
              <div className="border-t border-border/50 pt-4">
                <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Line Items</p>
                <dl className="mt-3 space-y-2.5">
                  {lineItems.map((li) => (
                    <div key={li.id} className="flex justify-between gap-4">
                      <dt className="min-w-0 flex-1 pr-2 text-foreground">{li.description}</dt>
                      <dd className="shrink-0 font-mono tabular-nums">{formatCurrency(li.amount_cents)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex justify-between border-t border-border/40 pt-2 text-sm font-medium">
                  <span>Line items subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(contract.line_items_total_cents ?? 0)}
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
      </div>

      {/* Notes */}
      {contract.notes && contract.status !== 'error' && (
        <Card>
          <div className="border-b border-border/50 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">Internal Notes</h2>
          </div>
          <CardContent className="p-6 text-sm whitespace-pre-wrap">{contract.notes}</CardContent>
        </Card>
      )}

      {/* Audit log — muted timeline; ids for progression scroll targets */}
      <section id="contract-activity" className="border-t border-border/40 pt-8">
        <p className="wf-label-caps mb-4 text-[0.6rem]">Activity</p>
        <ol className="relative space-y-0 border-l border-border/50 pl-6">
          {audit.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No activity yet</li>
          ) : (
            [...audit]
              .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
              .map(entry => {
                const actionText = describeAction(entry);
                const initials =
                  entry.actor_email?.split('@')[0]?.slice(0, 2).toUpperCase() ?? '·';
                return (
                  <li
                    key={entry.id}
                    id={`audit-${entry.id}`}
                    className="relative pb-6 pl-1 text-sm last:pb-0"
                  >
                    <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-border bg-muted ring-2 ring-bg-page" />
                    <div className="flex flex-wrap items-start gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground"
                        aria-hidden
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground/90">{actionText.title}</p>
                        {actionText.detail && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{actionText.detail}</p>
                        )}
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {formatTimestamp(entry.occurred_at)}
                          {entry.actor_email && ` · ${entry.actor_email}`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })
          )}
        </ol>
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          mono && 'font-mono tabular-nums',
          multiline && 'max-w-[min(100%,20rem)] whitespace-pre-wrap text-right text-sm leading-snug',
        )}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function describeAction(entry: AuditLogEntry): { title: string; detail?: string } {
  const money = (v: unknown) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? formatCurrency(n) : '$0.00';
  };

  switch (entry.action) {
    case 'created':
      return { title: 'Contract created' };
    case 'contract_created': {
      const meta = entry.metadata as Record<string, unknown> | null;
      const rep = String(meta?.rep_name ?? meta?.sales_rep_name ?? '');
      const creatorName = meta?.created_by_name ? String(meta.created_by_name) : '';
      if (meta?.on_behalf_of && creatorName && rep) {
        return {
          title: `Contract created by ${creatorName} on behalf of ${rep}`,
        };
      }
      const ob = meta?.on_behalf_of ? ' (on behalf of sales rep)' : '';
      return { title: `Contract created${ob}`, detail: rep ? `Sales rep: ${rep}` : undefined };
    }
    case 'status_changed': {
      const fromLabel = entry.from_status ? formatStatus(entry.from_status) : 'Unknown';
      const toLabel = entry.to_status ? formatStatus(entry.to_status) : 'Unknown';
      return { title: `Status changed from ${fromLabel} to ${toLabel}` };
    }
    case 'pdf_generated': return { title: 'Draft PDF generated' };
    case 'docusign_sent': return { title: 'Sent via DocuSign' };
    case 'docusign_completed': return { title: 'DocuSign contract completed — signed PDF stored' };
    case 'pdf_sent': return { title: 'Contract sent via DocuSign' };
    case 'docusign_recalled': return { title: 'DocuSign contract recalled — contract unlocked for edit' };
    case 'docusign_resend_notification': return { title: 'DocuSign signing email resent' };
    case 'docusign_send_reminder': return { title: 'DocuSign reminder sent' };
    case 'docusign_resent_with_changes': return { title: 'DocuSign contract voided and resent with changes' };
    case 'released_to_accounting': return { title: 'Released to accounting' };
    case 'signer_contact_updated': return { title: 'Exhibitor signer contact updated' };
    case 'discount_approved': {
      const approver = entry.metadata?.approver_email ? String(entry.metadata.approver_email) : 'admin';
      const reason = entry.metadata?.reason ? String(entry.metadata.reason) : '';
      return {
        title: `Discounted rate approved by ${approver}`,
        detail: reason || undefined,
      };
    }
    case 'discount_approval_reset':
      return {
        title: `Discount approval reset — booth rate changed from ${money(entry.metadata?.old_rate)} to ${money(entry.metadata?.new_rate)}`,
      };
    case 'events_submitted':
      return { title: 'Submitted for events team review' };
    case 'events_approved': {
      const meta = entry.metadata as Record<string, unknown> | null;
      const approver = meta?.approver ? String(meta.approver) : '';
      const reason = meta?.reason ? String(meta.reason) : '';
      return {
        title: approver ? `Events approval granted by ${approver}` : 'Events approval granted',
        detail: reason || undefined,
      };
    }
    case 'events_sent_back': {
      const meta = entry.metadata as Record<string, unknown> | null;
      const sender = meta?.sender ? String(meta.sender) : '';
      const reason = meta?.reason ? String(meta.reason) : '';
      return {
        title: sender ? `Sent back for changes by ${sender}` : 'Sent back for changes',
        detail: reason || undefined,
      };
    }
    case 'events_approval_reset': {
      const meta = entry.metadata as Record<string, unknown> | null;
      const oldApprover = meta?.old_approver ? String(meta.old_approver) : '';
      const reason = meta?.reason ? String(meta.reason) : '';
      return {
        title: oldApprover
          ? `Events approval cleared after PDF regeneration (was ${oldApprover})`
          : 'Events approval cleared after PDF regeneration',
        detail: reason || undefined,
      };
    }
    case 'signed': return { title: 'Signed by exhibitor' };
    case 'executed': return { title: 'Fully executed' };
    case 'cancelled':
      return { title: `Contract cancelled${entry.metadata?.reason ? ': ' + String(entry.metadata.reason) : ''}` };
    case 'error_reset_to_draft':
      return { title: 'Error cleared — contract reset to draft' };
    default:
      return { title: entry.action };
  }
}
