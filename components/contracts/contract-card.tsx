'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listPackageLabel } from '@/lib/contract-deal-kind';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { useHydrated } from '@/hooks/use-hydrated';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractWithTotals } from '@/types/db';

export function ContractCard({
  contract,
  portalBasePath = '',
  vendorLicense = portalBasePath === '/wine-spectator',
}: {
  contract: ContractWithTotals;
  portalBasePath?: string;
  vendorLicense?: boolean;
}) {
  const brands = (contract.brands_poured ?? '')
    .split(/[\n,;]+/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 4);
  const [updatedSummary, setUpdatedSummary] = useState<string | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const sync = () => {
      const daysSince = Math.max(
        0,
        Math.floor((Date.now() - new Date(contract.updated_at).getTime()) / 86400000),
      );
      setUpdatedSummary(
        `${daysSince} day${daysSince === 1 ? '' : 's'} since update · ${formatRelative(contract.updated_at)}`,
      );
    };
    sync();
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, [contract.updated_at, hydrated]);

  return (
    <Link
      href={`${portalBasePath}/contracts/${contract.id}`}
      className="block rounded-lg border border-parchment-200 bg-parchment-50 p-5 shadow-wf-editorial-sm transition-all hover:-translate-y-0.5 hover:shadow-wf-editorial motion-reduce:transform-none motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl font-medium leading-tight text-oak-800">{contract.exhibitor_company_name}</h3>
        <StatusBadge status={contract.status} />
      </div>
      {vendorLicense ? (
        <p className="mt-1 text-sm text-ink-600">
          {[
            contract.exhibitor_legal_name && contract.exhibitor_legal_name !== contract.exhibitor_company_name
              ? contract.exhibitor_legal_name
              : null,
            contract.signer_1_name,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      {brands.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {brands.map((brand) => (
            <span key={brand} className="rounded-full bg-parchment-100 px-2 py-0.5 text-xs text-ink-700">
              {brand}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Total</p>
          <p className="font-sans text-lg font-semibold tabular-nums text-oak-800">{formatCurrency(contract.grand_total_cents)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-500">Package</p>
          <p className="font-sans text-sm font-semibold leading-snug text-oak-800">
            {vendorLicense
              ? contract.order_type === 'sponsorship_only'
                ? 'Sponsorship only'
                : 'Vendor license'
              : listPackageLabel(contract)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-500" suppressHydrationWarning>
        {updatedSummary ?? (
          <>
            Updated <RelativeTime iso={contract.updated_at} />
          </>
        )}
      </p>
    </Link>
  );
}
