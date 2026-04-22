import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getContractWithTotalsForViewer } from '@/lib/auth-contract';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { requiresDiscountApproval, STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { cn, formatCurrency, formatLongDate, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { ContractActions } from '@/components/contracts/contract-actions';
import { SignerContactEdit } from '@/components/contracts/signer-contact-edit';
import type { ContractWithTotals, Event, AuditLogEntry } from '@/types/db';

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
  const [{ data: event }, audit] = await Promise.all([
    supabase.from('events').select('*').eq('id', contract.event_id).single(),
    loadAudit(contract.id),
  ]);

  const isAdmin = actor.isAdmin;
  const isEventsTeam = actor.isEventsTeam;
  const releaseAudit = audit.find((entry) => entry.action === 'released_to_accounting' || entry.action === 'executed');
  const discountPending = requiresDiscountApproval(contract);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href="/contracts" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All contracts
        </Link>
        <span className="text-border">/</span>
        <Link href="/" className="hover:text-foreground">Dashboard</Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {contract.exhibitor_company_name}
            </h1>
            <StatusBadge status={contract.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {contract.id.slice(0, 8)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {event?.name} · {event && formatLongDate(event.event_date)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Grand Total</p>
          <p className="font-serif text-3xl font-semibold tabular-nums text-fest-900">
            {formatCurrency(contract.grand_total_cents)}
          </p>
        </div>
      </div>

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
            draftPdfUrl={contract.draft_pdf_url}
            signedPdfUrl={contract.signed_pdf_url}
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
            salesRep={contract.sales_rep_name ?? contract.sales_rep_email ?? null}
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
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <div className="border-b border-border/50 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">Pricing</h2>
          </div>
          <CardContent className="space-y-3 p-6 text-sm">
            <Detail label="Booth Count" value={String(contract.booth_count)} />
            <Detail label="Booth Rate"  value={formatCurrency(contract.booth_rate_cents)} mono />
            <Detail label="Booth Total" value={formatCurrency(contract.booth_subtotal_cents)} mono />
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-base font-semibold">Grand Total</span>
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

      {/* Audit log */}
      <Card>
        <div className="border-b border-border/50 px-6 py-4">
          <h2 className="font-serif text-lg font-semibold">Activity</h2>
        </div>
        <CardContent className="p-0">
          <ol className="divide-y divide-border/40">
            {audit.length === 0 ? (
              <li className="p-6 text-sm text-muted-foreground">No activity yet</li>
            ) : (
              audit.map(entry => {
                const actionText = describeAction(entry);
                return (
                  <li key={entry.id} className="flex items-start gap-4 px-6 py-3 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-whisky-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">{actionText.title}</p>
                      {actionText.detail && (
                        <p className="text-xs text-muted-foreground">{actionText.detail}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.occurred_at)}
                        {entry.actor_email && ` · ${entry.actor_email}`}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ol>
        </CardContent>
      </Card>
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
    case 'status_changed': return { title: `Status changed from ${entry.from_status} to ${entry.to_status}` };
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
