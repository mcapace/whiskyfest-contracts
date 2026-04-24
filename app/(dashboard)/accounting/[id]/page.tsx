import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireAccountingPageAccess } from '@/lib/auth-accounting';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createContractPdfSignedUrl } from '@/lib/contract-pdf-storage';
import { calculateDiscountCents, calculateListSubtotalCents, isDiscountedRate } from '@/lib/contracts';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { AccountingDetailActions } from '@/components/accounting/accounting-detail-actions';
import { InvoiceLifecycleTimeline } from '@/components/accounting/invoice-lifecycle';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function AccountingContractDetailPage({ params }: { params: { id: string } }) {
  await requireAccountingPageAccess();

  const supabase = getSupabaseAdmin();
  const { data: contract, error } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<ContractWithTotals>();

  if (error || !contract) notFound();
  if (contract.status !== 'executed') notFound();

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle<Event>();

  const listCents = calculateListSubtotalCents(contract.booth_count);
  const discountCents = calculateDiscountCents(contract.booth_count, contract.booth_rate_cents);
  const pctOff =
    listCents > 0 && discountCents > 0 ? Math.round((discountCents / listCents) * 1000) / 10 : null;
  const discountLabel =
    isDiscountedRate(contract.booth_rate_cents) && discountCents > 0
      ? pctOff != null
        ? `${pctOff}% / ${formatCurrency(discountCents)}`
        : formatCurrency(discountCents)
      : '—';

  let pdfEmbedUrl: string | null = null;
  if (contract.pdf_storage_path) {
    try {
      pdfEmbedUrl = await createContractPdfSignedUrl(contract.pdf_storage_path);
    } catch {
      pdfEmbedUrl = null;
    }
  }

  const billingBlock =
    contract.billing_same_as_corporate ?? true
      ? formatExhibitorAddressBlock(contract)
      : formatBillingAddressBlock(contract);

  const inv = (contract.invoice_status ?? 'pending') as InvoiceStatus;

  return (
    <div className="space-y-8 pb-28 md:pb-32">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <Link href="/accounting" className="inline-flex items-center gap-1.5 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> AR Dashboard
        </Link>
      </div>

      <header className="border-b border-border/50 pb-6">
        <p className="wf-label-caps text-[0.6rem]">Contract</p>
        <h1 className="wf-display-serif mt-1 text-3xl tracking-tight md:text-4xl">{contract.exhibitor_company_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{event?.name ?? '—'}</p>
      </header>

      <section className="rounded-lg border border-border/50 bg-bg-surface p-4 md:p-6" data-tour="invoice-lifecycle">
        <p className="wf-label-caps mb-4 text-[0.6rem]">Invoice lifecycle</p>
        <InvoiceLifecycleTimeline status={inv} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardContent className="space-y-4 p-6 text-sm">
            <h2 className="font-serif text-lg font-semibold">Contract summary</h2>
            <dl className="grid gap-4 border-t border-border/50 pt-4 sm:grid-cols-2">
              <Detail label="Exhibitor" value={`${contract.exhibitor_company_name} — ${contract.signer_1_name ?? '—'}`} />
              <Detail label="Email" value={contract.signer_1_email} mono />
              <Detail label="Address" value={billingBlock || '—'} multiline />
              <Detail label="Sales Rep" value={contract.sales_rep_name ?? contract.sales_rep_email ?? '—'} />
              <Detail label="Event" value={event ? `${event.name} ${event.year}` : '—'} />
              <Detail label="Booth Rate" value={formatCurrency(contract.booth_rate_cents)} />
              <Detail label="Discount" value={discountLabel} />
              <Detail label="Total" value={formatCurrency(contract.grand_total_cents)} />
              <Detail label="Executed" value={contract.executed_at ? formatTimestamp(contract.executed_at) : '—'} />
              <Detail label="Countersigned by" value={contract.countersigned_by_name ?? '—'} />
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-3 p-6">
            <p className="wf-label-caps text-[0.6rem]">Signed PDF</p>
            {pdfEmbedUrl ? (
              <>
                <div className="overflow-hidden rounded-lg border border-border/60 shadow-md">
                  <iframe
                    title="Signed PDF"
                    src={pdfEmbedUrl}
                    className="h-[800px] w-full rounded-lg border border-border/60 bg-background md:aspect-[8.5/11] md:h-auto"
                  />
                </div>
                <a
                  href={`/api/contracts/${contract.id}/pdf?variant=signed`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-mono text-sm text-accent-brand underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Open / download PDF
                </a>
              </>
            ) : contract.signed_pdf_url ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <a
                    href={contract.signed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-accent-brand underline-offset-4 hover:underline"
                  >
                    Open PDF (legacy Google Drive)
                  </a>
                </p>
                <a
                  href={`/api/contracts/${contract.id}/pdf?variant=signed`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-mono text-sm text-accent-brand underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-4 w-4" /> Download PDF
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No signed PDF URL on file.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <AccountingDetailActions
        contractId={contract.id}
        invoiceStatus={inv}
        invoiceSentLabel={contract.invoice_sent_at ? formatTimestamp(contract.invoice_sent_at) : null}
        invoiceSentBy={contract.invoice_sent_by}
        paidLabel={contract.paid_at ? formatTimestamp(contract.paid_at) : null}
        paidBy={contract.paid_by}
        initialNotes={contract.accounting_notes}
        notesRecordUpdatedLabel={formatTimestamp(contract.updated_at)}
      />
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
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 text-foreground ${mono ? 'font-mono text-xs' : ''} ${
          multiline ? 'whitespace-pre-wrap text-sm leading-snug' : ''
        }`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
