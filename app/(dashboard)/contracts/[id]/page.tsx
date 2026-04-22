import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { cn, formatCurrency, formatLongDate, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { ContractActions } from '@/components/contracts/contract-actions';
import { SignerContactEdit } from '@/components/contracts/signer-contact-edit';
import type { ContractWithTotals, Event, AuditLogEntry } from '@/types/db';

export const dynamic = 'force-dynamic';

async function getContract(id: string) {
  const supabase = getSupabaseAdmin();

  const [{ data: contract }, { data: audit }] = await Promise.all([
    supabase.from('contracts_with_totals').select('*').eq('id', id).single(),
    supabase.from('audit_log').select('*').eq('contract_id', id).order('occurred_at', { ascending: false }),
  ]);

  if (!contract) return null;

  const { data: event } = await supabase
    .from('events').select('*').eq('id', contract.event_id).single();

  return {
    contract: contract as ContractWithTotals,
    event:    event as Event | null,
    audit:    (audit ?? []) as AuditLogEntry[],
  };
}

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  const data = await getContract(params.id);
  if (!data) notFound();
  const { contract, event, audit } = data;

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
            <StatusBadge status={contract.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {contract.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {contract.exhibitor_company_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {event?.name} — {event && formatLongDate(event.event_date)}
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

      <Card>
        <CardContent className="p-4">
          <ContractActions
            contractId={contract.id}
            exhibitorName={contract.exhibitor_company_name}
            status={contract.status}
            draftPdfUrl={contract.draft_pdf_url}
            signedPdfUrl={contract.signed_pdf_url}
            docusignEnvelopeId={contract.docusign_envelope_id}
          />
        </CardContent>
      </Card>

      {/* Two-column details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exhibitor */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">Exhibitor</h2>
            {(contract.status === 'approved' || contract.status === 'ready_for_review') && (
              <SignerContactEdit
                contractId={contract.id}
                initialName={contract.signer_1_name}
                initialTitle={contract.signer_1_title}
                initialEmail={contract.signer_1_email}
              />
            )}
          </div>
          <CardContent className="space-y-3 p-6 text-sm">
            <Detail label="Legal Name"   value={contract.exhibitor_legal_name} />
            <Detail label="Display Name" value={contract.exhibitor_company_name} />
            <Detail label="Address"      value={formatExhibitorAddressBlock(contract)} multiline />
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
            <Detail label="Booth Subtotal" value={formatCurrency(contract.booth_subtotal_cents)} mono />
            <Detail label="Additional Brands" value={String(contract.additional_brand_count)} />
            <Detail label="Additional Fee"   value={formatCurrency(contract.additional_brand_fee_cents)} mono />
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
      {contract.notes && (
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
              audit.map(entry => (
                <li key={entry.id} className="flex items-start gap-4 px-6 py-3 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-whisky-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {describeAction(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.occurred_at)}
                      {entry.actor_email && ` · ${entry.actor_email}`}
                    </p>
                  </div>
                </li>
              ))
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

function describeAction(entry: AuditLogEntry): string {
  switch (entry.action) {
    case 'created':        return 'Contract created';
    case 'status_changed': return `Status changed from ${entry.from_status} to ${entry.to_status}`;
    case 'pdf_generated':   return 'Draft PDF generated';
    case 'docusign_sent':   return 'Sent via DocuSign';
    case 'docusign_completed': return 'DocuSign contract completed — signed PDF stored';
    case 'pdf_sent':        return 'Contract sent via DocuSign';
    case 'docusign_recalled': return 'DocuSign contract recalled — contract unlocked for edit';
    case 'docusign_resend_notification': return 'DocuSign signing email resent';
    case 'signer_contact_updated': return 'Exhibitor signer contact updated';
    case 'signed':         return 'Signed by exhibitor';
    case 'executed':       return 'Fully executed';
    case 'cancelled':      return `Contract cancelled${entry.metadata?.reason ? ': ' + String(entry.metadata.reason) : ''}`;
    default:               return entry.action;
  }
}
