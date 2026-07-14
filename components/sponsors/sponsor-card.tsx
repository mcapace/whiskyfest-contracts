'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractStatus } from '@/types/db';
import type { SponsorRecord } from '@/lib/sponsors';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SWATCH = [
  'bg-amber-100 text-amber-800',
  'bg-parchment-200 text-oak-800',
  'bg-stone-200 text-stone-800',
  'bg-orange-100 text-orange-900',
];

export function SponsorCard({
  sponsor,
  index,
  brandNames,
  logoUrl,
  onOpen,
}: {
  sponsor: SponsorRecord;
  index: number;
  brandNames: string[];
  logoUrl: string | null;
  onOpen: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const brands = brandNames.slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full min-h-[280px] w-full flex-col rounded-lg border border-parchment-200 bg-parchment-50 p-4 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex h-[140px] shrink-0 items-center justify-center rounded-md border border-parchment-200 bg-white px-4">
        {showLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- external logo CDN with runtime fail → initials
          <img
            src={logoUrl!}
            alt=""
            className="max-h-20 max-w-[85%] object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold',
              SWATCH[index % SWATCH.length],
            )}
          >
            {initials(sponsor.exhibitor_company_name)}
          </div>
        )}
      </div>

      <div className="mt-4 flex min-h-[3.25rem] items-start gap-2">
        <h3 className="line-clamp-2 flex-1 font-display text-xl font-medium leading-snug text-oak-800 sm:text-2xl">
          {sponsor.exhibitor_company_name}
        </h3>
        <StatusBadge status={sponsor.status as ContractStatus} />
      </div>

      <p className="mt-2 text-sm text-ink-700">
        Booths: <span className="font-semibold tabular-nums">{sponsor.booth_count}</span>
      </p>

      <div className="mt-auto min-h-[2.5rem] pt-3">
        {brands.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {brands.map((brand) => (
              <span key={brand} className="rounded-full bg-parchment-100 px-2 py-0.5 text-xs text-ink-700">
                {brand}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        )}
      </div>
    </button>
  );
}
