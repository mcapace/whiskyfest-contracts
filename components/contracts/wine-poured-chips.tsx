import { parseRosterWineDisplay } from '@/lib/exhibitor-roster-columns';
import { cn } from '@/lib/utils';

export function WinePouredChips({
  brandsPoured,
  className,
}: {
  brandsPoured: string | null | undefined;
  className?: string;
}) {
  const parsed = parseRosterWineDisplay(brandsPoured);
  if (!parsed) return null;
  const full = [parsed.wine, parsed.vintage].filter(Boolean).join(' · ');
  if (!parsed.wine && parsed.vintage) {
    return (
      <div className={cn('mt-1.5 flex min-w-0 items-center', className)}>
        <span className="shrink-0 whitespace-nowrap rounded-md bg-fest-50 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none tabular-nums text-fest-800">
          {parsed.vintage}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('mt-1.5 flex min-w-0 max-w-[18rem] items-center gap-1.5', className)}>
      <span
        className="min-w-0 truncate whitespace-nowrap rounded-md bg-muted/70 px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground"
        title={full}
      >
        {parsed.wine}
      </span>
      {parsed.vintage ? (
        <span className="shrink-0 whitespace-nowrap rounded-md bg-fest-50 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none tabular-nums text-fest-800">
          {parsed.vintage}
        </span>
      ) : null}
    </div>
  );
}
