'use client';

import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractStatus } from '@/types/db';
import type { SponsorRecord } from '@/lib/sponsors';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SWATCH = [
  'bg-amber-100 text-amber-700',
  'bg-parchment-200 text-oak-800',
  'bg-info-bg text-info-base',
  'bg-success-bg text-success-base',
];

export function SponsorCard({
  sponsor,
  index,
  onOpen,
}: {
  sponsor: SponsorRecord;
  index: number;
  onOpen: () => void;
}) {
  const brands = (sponsor.brands_poured ?? '')
    .split(/[\n,;]+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-parchment-200 bg-parchment-50 p-4 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="mb-4 flex h-[150px] items-center justify-center rounded-md border border-parchment-200 bg-parchment-100/80">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold ${SWATCH[index % SWATCH.length]}`}>
          {initials(sponsor.exhibitor_company_name)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-2xl font-medium text-oak-800">{sponsor.exhibitor_company_name}</h3>
        <StatusBadge status={sponsor.status as ContractStatus} />
      </div>
      <p className="mt-2 text-sm text-ink-700">
        Booths: <span className="tabular-nums font-semibold">{sponsor.booth_count}</span>
      </p>
      {brands.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {brands.map((brand) => (
            <span key={brand} className="rounded-full bg-parchment-100 px-2 py-0.5 text-xs text-ink-700">{brand}</span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
