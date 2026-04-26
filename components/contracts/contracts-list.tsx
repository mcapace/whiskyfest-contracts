'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, MoreHorizontal, Table2 } from 'lucide-react';
import { formatCurrency, formatRelative } from '@/lib/utils';
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
import { ContractsFilterBar } from '@/components/contracts/filter-bar';
import { SavedViewsDropdown, type ContractViewFilters } from '@/components/contracts/saved-views-dropdown';
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

function categorizeBrands(brandsPoured: string | null): string {
  const n = (brandsPoured ?? '').toLowerCase();
  if (!n) return 'Other';
  if (n.includes('bourbon')) return 'Bourbon';
  if (n.includes('scotch') || n.includes('islay') || n.includes('speyside') || n.includes('highland')) return 'Scotch';
  if (n.includes('irish')) return 'Irish';
  if (n.includes('japanese') || n.includes('japan')) return 'Japanese';
  if (n.includes('rye')) return 'Rye';
  return 'Other';
}

function firstBrandPill(brandsPoured: string | null): string | null {
  const first = (brandsPoured ?? '')
    .split(/[\n,;]+/)
    .map((b) => b.trim())
    .filter(Boolean)[0];
  return first ?? null;
}

export function ContractsList({
  contracts,
  events,
  currentRepId,
}: {
  contracts: ContractWithTotals[];
  events: Event[];
  currentRepId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [filters, setFilters] = useState<ContractViewFilters>({
    status: 'all',
    rep: 'all',
    brand: 'all',
    search: '',
    listPreset: 'none',
  });
  const [searchInput, setSearchInput] = useState('');
  const [customViews, setCustomViews] = useState<{ name: string; filters: ContractViewFilters }[]>([]);
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);

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
    contracts.forEach((c) => set.add(categorizeBrands(c.brands_poured)));
    return [{ value: 'all', label: 'All' }, ...[...set].sort().map((value) => ({ value, label: value }))];
  }, [contracts]);

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
      if (filters.brand !== 'all' && categorizeBrands(c.brands_poured) !== filters.brand) return false;
      const q = filters.search.trim().toLowerCase();
      if (q) {
        const blob = [
          c.exhibitor_company_name,
          c.signer_1_name,
          c.signer_1_email,
          c.brands_poured,
          c.sales_rep_name,
          c.sales_rep_email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, filters, currentRepId]);

  const activeCount = filtered.filter((c) => c.status !== 'cancelled' && c.status !== 'voided').length;
  const pipelineCount = filtered.filter((c) =>
    ['draft', 'ready_for_review', 'pending_events_review', 'approved', 'sent', 'partially_signed', 'signed'].includes(
      c.status,
    ),
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
    setFilters({ status: 'all', rep: 'all', brand: 'all', search: '', listPreset: 'none' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-medium tracking-tight text-oak-800">Contracts</h1>
          <p className="mt-2 font-sans text-sm text-ink-700">
            {filtered.length} shown · {activeCount} active · {pipelineCount} in pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SavedViewsDropdown onApply={setFilters} customSaved={customViews} />
          <Button variant="outline" onClick={saveCurrentView}>
            Save view
          </Button>
          <div className="inline-flex rounded-md border border-parchment-300 bg-parchment-50 p-0.5">
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${view === 'table' ? 'bg-oak-800 text-parchment-50' : 'text-ink-700'}`}
              onClick={() => setView('table')}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 text-xs ${view === 'cards' ? 'bg-oak-800 text-parchment-50' : 'text-ink-700'}`}
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
          { value: 'executed', label: 'Executed' },
        ]}
        repOptions={repOptions}
        brandOptions={brandOptions}
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-parchment-200 bg-parchment-50 px-6 py-16 text-center">
          <h3 className="font-display text-3xl font-medium text-oak-800">No contracts match your filters</h3>
          <p className="mt-3 font-sans text-sm text-ink-600">Try broadening your criteria or clear filters to explore all contracts.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
            <Button variant="default" asChild>
              <Link href="/contracts/new">Create new contract</Link>
            </Button>
          </div>
        </div>
      ) : view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-parchment-200 bg-parchment-50">
          <Table className="font-sans [&_tbody_tr]:origin-left [&_tbody_tr]:transition-all [&_tbody_tr:hover]:scale-[1.005] [&_tbody_tr:hover]:bg-parchment-100">
            <TableHeader>
              <TableRow>
                <TableHead>Company / Brand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="tabular-nums">Booths</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Last Activity</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const pill = firstBrandPill(c.brands_poured);
                return (
                  <TableRow
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={() => router.push(`/contracts/${c.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/contracts/${c.id}`);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="font-medium text-oak-800">{c.exhibitor_company_name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-ink-500">{eventMap.get(c.event_id) ?? '—'}</span>
                        {pill ? (
                          <span className="rounded-full border border-parchment-300 bg-parchment-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                            {pill}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="tabular-nums">{c.booth_count}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                    <TableCell>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs text-ink-500 tabular-nums">{formatRelative(c.updated_at)}</TableCell>
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
                          <DropdownMenuItem onSelect={() => router.push(`/contracts/${c.id}`)}>View contract</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => window.open(`/contracts/${c.id}`, '_blank')}>
                            Open in new tab
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
