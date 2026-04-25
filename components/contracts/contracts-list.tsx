'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Table2 } from 'lucide-react';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ContractCard } from '@/components/contracts/contract-card';
import { ContractsFilterBar } from '@/components/contracts/filter-bar';
import { SavedViewsDropdown, type ContractViewFilters } from '@/components/contracts/saved-views-dropdown';
import type { ContractWithTotals, Event } from '@/types/db';

const STORAGE_KEY = 'wf.contracts.savedViews.v1';

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

export function ContractsList({
  contracts,
  events,
  currentRepId,
}: {
  contracts: ContractWithTotals[];
  events: Event[];
  currentRepId: string | null;
}) {
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [filters, setFilters] = useState<ContractViewFilters>({ status: 'all', rep: 'all', brand: 'all', search: '' });
  const [customViews, setCustomViews] = useState<{ name: string; filters: ContractViewFilters }[]>([]);
  const eventMap = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCustomViews(JSON.parse(raw));
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
    ['draft', 'ready_for_review', 'pending_events_review', 'approved', 'sent', 'partially_signed', 'signed'].includes(c.status),
  ).length;

  function saveCurrentView() {
    const name = window.prompt('Name this view');
    if (!name?.trim()) return;
    const next = [...customViews, { name: name.trim(), filters }];
    setCustomViews(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-medium tracking-tight text-oak-800">Contracts</h1>
          <p className="mt-2 text-sm text-ink-700">{activeCount} active · {pipelineCount} in pipeline</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SavedViewsDropdown onApply={setFilters} customSaved={customViews} />
          <Button variant="outline" onClick={saveCurrentView}>Save view</Button>
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
          <p className="mt-3 text-sm text-ink-600">Try broadening your criteria or clear filters to explore all contracts.</p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => setFilters({ status: 'all', rep: 'all', brand: 'all', search: '' })}>
              Clear filters
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
          <Table className="[&_tbody_tr]:transition-all [&_tbody_tr:hover]:bg-parchment-100">
            <TableHeader>
              <TableRow>
                <TableHead>Company / Brand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booths</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Sales Rep</TableHead>
                <TableHead className="text-right">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => (window.location.href = `/contracts/${c.id}`)}>
                  <TableCell>
                    <div className="font-medium text-oak-800">{c.exhibitor_company_name}</div>
                    <div className="mt-0.5 text-xs text-ink-500">{eventMap.get(c.event_id) ?? '—'}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="tabular-nums">{c.booth_count}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                  <TableCell>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs text-ink-500">{formatRelative(c.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
