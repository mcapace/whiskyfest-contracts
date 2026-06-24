'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useHydrated } from '@/hooks/use-hydrated';
import { useSafeReducedMotion } from '@/hooks/use-safe-reduced-motion';
import { LayoutGrid, MoreHorizontal, Table2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContractCard } from '@/components/contracts/contract-card';
import { ImportSuccessBanner } from '@/components/contracts/import-success-banner';
import { ContractsFilterBar } from '@/components/contracts/filter-bar';
import { SavedViewsDropdown, type ContractViewFilters } from '@/components/contracts/saved-views-dropdown';
import { categorizeContractBrands } from '@/lib/brand-category';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';
import { CONTRACT_DEAL_KINDS, dealKindFromContract, dealKindLabel, listPackageLabel } from '@/lib/contract-deal-kind';
import type { BoothBrandRowsByContract } from '@/lib/sponsors';
import type { ContractWithTotals, Event } from '@/types/db';

const STORAGE_KEY = 'wf.contracts.savedViews.v1';

const PENDING_ACTION_STATUSES = new Set([
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
]);

const STUCK_STATUSES = new Set(['sent', 'pending_events_review', 'draft', 'ready_for_review', 'approved']);

function categorizeContractForFilter(
  contract: { id: string; brands_poured: string | null; exhibitor_company_name: string },
  boothRowsByContract: BoothBrandRowsByContract,
): string {
  return categorizeContractBrands(contract, boothRowsByContract[contract.id] ?? []);
}

function firstBrandPill(brandsPoured: string | null): string | null {
  const first = (brandsPoured ?? '')
    .split(/[\n,;]+/)
    .map((b) => b.trim())
    .filter(Boolean)[0];
  return first ?? null;
}

const MotionTableRow = motion(TableRow);

export function ContractsList({
  contracts,
  events,
  currentRepId,
  boothRowsByContract = {},
  portalBasePath = '',
  importedContractId,
  importedExhibitorName,
}: {
  contracts: ContractWithTotals[];
  events: Event[];
  currentRepId: string | null;
  boothRowsByContract?: BoothBrandRowsByContract;
  /** e.g. '' for WhiskyFest, '/wine-spectator' for Wine Spectator section */
  portalBasePath?: string;
  importedContractId?: string;
  importedExhibitorName?: string | null;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const reduceMotion = useSafeReducedMotion();
  const animate = hydrated && !reduceMotion;
  const [view, setView] = useState<'table' | 'cards'>('table');

  useEffect(() => {
    const off = subscribeToAppContractEvents(() => {
      router.refresh();
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [router]);

  const [filters, setFilters] = useState<ContractViewFilters>({
    status: 'all',
    rep: 'all',
    brand: 'all',
    dealType: 'all',
    search: '',
    listPreset: 'none',
  });
  const [searchInput, setSearchInput] = useState('');
  const [customViews, setCustomViews] = useState<{ name: string; filters: ContractViewFilters }[]>([]);
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);
  const contractHref = (id: string) => `${portalBasePath}/contracts/${id}`;
  const newContractHref = `${portalBasePath}/contracts/new`;

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { name: string; filters: ContractViewFilters }[];
      setCustomViews(
        parsed.map((v) => ({
          ...v,
          filters: {
            status: v.filters.status ?? 'all',
            rep: v.filters.rep ?? 'all',
            brand: v.filters.brand ?? 'all',
            dealType: v.filters.dealType ?? 'all',
            search: v.filters.search ?? '',
            listPreset: v.filters.listPreset ?? 'none',
          },
        })),
      );
    } catch {
      setCustomViews([]);
    }
  }, []);

  const repOptions = useMemo(() => {
    const reps = new Map<string, string>();
    for (const c of contracts) {
      if (c.sales_rep_id) reps.set(c.sales_rep_id, c.sales_rep_name ?? c.sales_rep_email ?? c.sales_rep_id);
    }
    const opts = [...reps.entries()].map(([value, label]) => ({ value, label }));
    return [{ value: 'all', label: 'All' }, ...(currentRepId ? [{ value: 'mine', label: 'Mine' }] : []), ...opts];
  }, [contracts, currentRepId]);

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => set.add(categorizeContractForFilter(c, boothRowsByContract)));
    return [{ value: 'all', label: 'All' }, ...[...set].sort().map((value) => ({ value, label: value }))];
  }, [contracts, boothRowsByContract]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (filters.listPreset === 'pending_action') {
        if (!PENDING_ACTION_STATUSES.has(c.status)) return false;
      } else if (filters.listPreset === 'recent_signed') {
        if (c.status !== 'signed') return false;
        if (!c.signed_at) return false;
        const signedMs = new Date(c.signed_at).getTime();
        if (Number.isNaN(signedMs) || Date.now() - signedMs > 7 * 86400000) return false;
      } else if (filters.listPreset === 'stuck') {
        if (!STUCK_STATUSES.has(c.status)) return false;
        const updatedMs = new Date(c.updated_at).getTime();
        if (Number.isNaN(updatedMs)) return false;
        if ((Date.now() - updatedMs) / 86400000 <= 7) return false;
      }

      if (filters.status !== 'all') {
        if (filters.status === 'draft') {
          if (c.status !== 'draft' && c.status !== 'ready_for_review') return false;
        } else if (c.status !== filters.status) return false;
      }
      if (filters.rep !== 'all') {
        const matchMine = filters.rep === 'mine' ? currentRepId : filters.rep;
        if (!matchMine || c.sales_rep_id !== matchMine) return false;
      }
      if (filters.brand !== 'all' && categorizeContractForFilter(c, boothRowsByContract) !== filters.brand)
        return false;
      if (filters.dealType !== 'all' && dealKindFromContract(c) !== filters.dealType) return false;
      const q = filters.search.trim().toLowerCase();
      if (q) {
        const boothBrandText = (boothRowsByContract[c.id] ?? [])
          .flatMap((row) => [row.brand_name, ...(row.expressions ?? [])])
          .join(' ');
        const blob = [
          c.exhibitor_company_name,
          c.signer_1_name,
          c.signer_1_email,
          c.brands_poured,
          boothBrandText,
          c.sales_rep_name,
          c.sales_rep_email,
          listPackageLabel(c),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, filters, currentRepId, boothRowsByContract]);

  const activeCount = filtered.filter((c) => c.status !== 'cancelled' && c.status !== 'voided').length;
  const pipelineCount = filtered.filter((c) =>
    [
      'draft',
      'ready_for_review',
      'pending_events_review',
      'approved',
      'sent',
      'partially_signed',
      'signed',
      'imported',
    ].includes(c.status),
  ).length;

  function saveCurrentView() {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    const next = [...customViews, { name: name.trim(), filters }];
    setCustomViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ status: 'all', rep: 'all', brand: 'all', dealType: 'all', search: '', listPreset: 'none' });
  };

  return (
    <div className="space-y-6">
      {importedContractId ? (
        <ImportSuccessBanner
          contractId={importedContractId}
          exhibitorName={importedExhibitorName ?? null}
          portalBasePath={portalBasePath}
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-medium tracking-tight text-foreground">Contracts</h1>
          <p className="mt-2 font-sans text-sm text-foreground">
            {filtered.length} shown · {activeCount} active · {pipelineCount} in pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SavedViewsDropdown onApply={setFilters} customSaved={customViews} />
          <Button variant="outline" onClick={saveCurrentView}>
            Save view
          </Button>
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${view === 'table' ? 'bg-oak-800 text-parchment-50' : 'text-foreground'}`}
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${view === 'cards' ? 'bg-oak-800 text-parchment-50' : 'text-foreground'}`}
              onClick={() => setView('cards')}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ContractsFilterBar
        filters={filters}
        searchDraft={searchInput}
        onSearchDraftChange={setSearchInput}
        onChange={setFilters}
        statusOptions={[
          { value: 'all', label: 'All' },
          { value: 'draft', label: 'Draft' },
          { value: 'pending_events_review', label: 'Pending Review' },
          { value: 'approved', label: 'Approved' },
          { value: 'sent', label: 'Sent' },
          { value: 'signed', label: 'Signed' },
          { value: 'imported', label: 'Imported' },
          { value: 'executed', label: 'Executed' },
          { value: 'voided', label: 'Voided' },
        ]}
        dealTypeOptions={[
          { value: 'all', label: 'All' },
          ...CONTRACT_DEAL_KINDS.map((kind) => ({ value: kind, label: dealKindLabel(kind) })),
        ]}
        repOptions={repOptions}
        brandOptions={brandOptions}
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
          <h3 className="font-display text-3xl font-medium text-foreground">No contracts match your filters</h3>
          <p className="mt-3 font-sans text-sm text-muted-foreground">Try broadening your criteria or clear filters to explore all contracts.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
            <Button variant="default" asChild>
              <Link href={newContractHref}>Create new contract</Link>
            </Button>
          </div>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contract, i) => {
            const card = <ContractCard contract={contract} portalBasePath={portalBasePath} />;
            if (!animate) {
              return <div key={contract.id}>{card}</div>;
            }
            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.26,
                  delay: Math.min(i, 18) * 0.032,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                {card}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-wf-editorial-sm">
          <Table className="font-sans [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted">
            <TableHeader>
              <TableRow>
                <TableHead>Company / Brand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Package</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Last Activity</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, rowIdx) => {
                const pill = firstBrandPill(c.brands_poured);
                const rowProps = {
                  role: 'link' as const,
                  tabIndex: 0,
                  className: 'cursor-pointer',
                  onClick: () => router.push(contractHref(c.id)),
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(contractHref(c.id));
                    }
                  },
                };
                const cells = (
                  <>
                    <TableCell>
                      <div className="font-medium text-foreground">{c.exhibitor_company_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{eventMap.get(c.event_id) ?? '—'}</span>
                        {pill ? (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {pill}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{listPackageLabel(c)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                    <TableCell>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      <RelativeTime iso={c.updated_at} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${c.exhibitor_company_name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onSelect={() => router.push(contractHref(c.id))}>View contract</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => window.open(contractHref(c.id), '_blank')}>
                            Open in new tab
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </>
                );
                if (!animate) {
                  return (
                    <TableRow key={c.id} {...rowProps}>
                      {cells}
                    </TableRow>
                  );
                }
                return (
                  <MotionTableRow
                    key={c.id}
                    {...rowProps}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: Math.min(rowIdx, 20) * 0.028,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                  >
                    {cells}
                  </MotionTableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
