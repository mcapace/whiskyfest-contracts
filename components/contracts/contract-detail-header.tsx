'use client';

import { StatusBadge } from '@/components/contracts/status-badge';
import { formatCurrency } from '@/lib/utils';
import { useContractLiveOptional } from '@/components/contracts/contract-live-context';
import type { ContractStatus } from '@/types/db';

export function ContractDetailHeader({
  title,
  subtitle,
  status,
  boothCount,
  totalCents,
  salesRep,
}: {
  title: string;
  subtitle: string;
  status: ContractStatus;
  boothCount: number;
  totalCents: number;
  salesRep: string | null;
}) {
  const live = useContractLiveOptional();
  const shownStatus = (live?.optimisticStatus ?? status) as ContractStatus;

  return (
    <header className="space-y-3 border-b border-parchment-200 pb-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-500">Contract</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-5xl font-medium tracking-tight text-oak-800">{title}</h1>
        <StatusBadge status={shownStatus} />
      </div>
      <p className="font-display text-lg italic text-ink-700">{subtitle}</p>
      <div className="flex flex-wrap gap-6 border-t border-parchment-200 pt-3 text-sm text-ink-700">
        <p>
          <span className="text-ink-500">Booths</span> ·{' '}
          <span className="tabular-nums font-semibold text-oak-800">{boothCount}</span>
        </p>
        <p>
          <span className="text-ink-500">Total</span> ·{' '}
          <span className="tabular-nums font-semibold text-oak-800">{formatCurrency(totalCents)}</span>
        </p>
        <p>
          <span className="text-ink-500">Sales Rep</span> ·{' '}
          <span className="font-semibold text-oak-800">{salesRep ?? '—'}</span>
        </p>
      </div>
    </header>
  );
}
