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
