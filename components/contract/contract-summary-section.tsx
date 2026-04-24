import type { ReactNode } from 'react';
import { cn, formatCurrency, formatLongDate, formatTimestamp } from '@/lib/utils';
import { formatStatus } from '@/lib/status-display';
import type { ContractWithTotals, Event } from '@/types/db';

export function ContractSummarySection({
  contract,
  event,
}: {
  contract: ContractWithTotals;
  event: Event | null;
}) {
  const boothSummary =
    contract.booth_count === 1 ? '1 booth' : `${contract.booth_count} booths`;

  return (
    <section className="divide-y divide-border/50 border-b border-border/50 pb-8">
      <div className="pb-6">
        <p className="wf-display-serif text-2xl tracking-tight text-foreground md:text-3xl">
          {contract.exhibitor_company_name}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{boothSummary}</span>
          <span className="mx-2 text-border">·</span>
          {formatStatus(contract.status)}
          {event && (
            <>
              <span className="mx-2 text-border">·</span>
              {event.name} · {formatLongDate(event.event_date)}
            </>
          )}
        </p>
      </div>

      <div className="grid gap-y-5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryField label="Grand total" value={formatCurrency(contract.grand_total_cents)} mono emphasis />
        <SummaryField label="Booth rate" value={formatCurrency(contract.booth_rate_cents)} mono />
        <SummaryField label="Booth count" value={String(contract.booth_count)} />
        <SummaryField label="Sales rep" value={contract.sales_rep_name ?? contract.sales_rep_email ?? '—'} />
        <SummaryField label="Signer" value={contract.signer_1_name?.trim() || '—'} />
        <SummaryField
          label="Email"
          value={
            contract.signer_1_email?.trim() ? (
              <a
                href={`mailto:${contract.signer_1_email.trim()}`}
                className="underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary hover:decoration-primary"
              >
                {contract.signer_1_email.trim()}
              </a>
            ) : (
              '—'
            )
          }
        />
        <SummaryField label="Title" value={contract.signer_1_title?.trim() || '—'} />
        <SummaryField label="Last updated" value={formatTimestamp(contract.updated_at)} mono />
      </div>
    </section>
  );
}

function SummaryField({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="wf-label-caps text-[0.6rem]">{label}</p>
      <div
        className={cn(
          'mt-1.5 text-foreground',
          emphasis && 'font-mono text-xl font-semibold tabular-nums tracking-tight md:text-2xl',
          mono && !emphasis && 'font-mono text-sm tabular-nums',
          !mono && !emphasis && 'text-base font-medium',
        )}
      >
        {value}
      </div>
    </div>
  );
}
