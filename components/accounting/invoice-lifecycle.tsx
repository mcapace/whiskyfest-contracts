import { cn } from '@/lib/utils';
import { formatInvoiceStatus } from '@/lib/invoice-status';
import type { InvoiceStatus } from '@/types/db';

const STEPS: { key: InvoiceStatus; label: string }[] = [
  { key: 'pending', label: formatInvoiceStatus('pending') },
  { key: 'invoice_sent', label: formatInvoiceStatus('invoice_sent') },
  { key: 'paid', label: formatInvoiceStatus('paid') },
];

export function InvoiceLifecycleTimeline({
  status,
}: {
  status: InvoiceStatus;
}) {
  if (status === 'not_invoiced') {
    return (
      <div className="rounded-lg border border-violet-300/80 bg-violet-50/60 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30">
        <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
          {formatInvoiceStatus('not_invoiced')}
        </p>
        <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/80">
          Complimentary booth — tracked in A/R for visibility only. Do not send an invoice.
        </p>
      </div>
    );
  }

  if (status === 'invoice_voided') {
    return (
      <div className="rounded-lg border border-rose-300/80 bg-rose-50/60 px-4 py-3">
        <p className="text-sm font-medium text-rose-950">{formatInvoiceStatus('invoice_voided')}</p>
        <p className="mt-1 text-xs text-rose-900/80">
          This sent invoice was cancelled. Restore to Pending from AR Actions if it should be billed again.
        </p>
      </div>
    );
  }

  const idx = STEPS.findIndex((s) => s.key === status);
  const currentIdx = idx >= 0 ? idx : 0;

  return (
    <div className="w-full">
      <div className="flex items-center gap-1 md:justify-between">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'h-[14px] w-[14px] rounded-full border transition-colors',
                  i < currentIdx && 'border-accent-brand bg-accent-brand',
                  i === currentIdx && 'border-accent-brand bg-background shadow-[0_0_0_3px_hsl(var(--accent-brand)/0.25)] motion-safe:animate-wf-node-pulse',
                  i > currentIdx && 'border-muted-foreground/40 bg-transparent',
                )}
              />
              <span className="mt-2 hidden max-w-[6rem] text-center text-[10px] font-medium text-muted-foreground lg:block">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 min-w-[8px] flex-1 rounded-full',
                  i < currentIdx ? 'bg-accent-brand' : 'border-t border-dashed border-muted-foreground/40 bg-transparent',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
