import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { ContractActions } from '@/components/contracts/contract-actions';
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
            {event?.name} — {event && new Date(event.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Grand Total</p>
          <p className="font-serif text-3xl font-semibold tabular-nums text-fest-900">
            {formatCurrency(contract.grand_total_cents)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <ContractActions
            contractId={contract.id}
            status={contract.status}
            draftPdfUrl={contract.draft_pdf_url}
            signedPdfUrl={contract.signed_pdf_url}
          />
        </CardContent>
      </Card>

      {/* Two-column details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Exhibitor */}
        <Card>
          <div className="border-b border-border/50 px-6 py-4">
            <h2 className="font-serif text-lg font-semibold">Exhibitor</h2>
          </div>
          <CardContent className="space-y-3 p-6 text-sm">
            <Detail label="Legal Name"   value={contract.exhibitor_legal_name} />
            <Detail label="Display Name" value={contract.exhibitor_company_name} />
            <Detail label="Address"      value={contract.exhibitor_address} />
            <Detail label="Telephone"    value={contract.exhibitor_telephone} />
            <Detail label="Brands"       value={contract.brands_poured} />
            <Detail label="Signer"       value={[contract.signer_1_name, contract.signer_1_title].filter(Boolean).join(', ') || '—'} />
            <Detail label="Email"        value={contract.signer_1_email} />
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

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono tabular-nums' : ''}>{value || '—'}</span>
    </div>
  );
}

function describeAction(entry: AuditLogEntry): string {
  switch (entry.action) {
    case 'created':        return 'Contract created';
    case 'status_changed': return `Status changed from ${entry.from_status} to ${entry.to_status}`;
    case 'pdf_generated':  return 'Draft PDF generated';
    case 'pdf_sent':       return 'Contract sent via DocuSign';
    case 'signed':         return 'Signed by exhibitor';
    case 'executed':       return 'Fully executed';
    default:               return entry.action;
  }
}
