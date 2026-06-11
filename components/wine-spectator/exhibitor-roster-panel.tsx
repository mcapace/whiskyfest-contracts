'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Columns3, Loader2, RefreshCw, Send, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatRelative } from '@/lib/utils';
import {
  rosterColumnModeLabel,
  visibleSheetColumns,
  visibleUiColumns,
  type RosterColumnMode,
} from '@/lib/exhibitor-roster-columns';
import { rosterListBadgeClass, rosterListRowClass, rosterListStyle } from '@/lib/exhibitor-roster-list-style';
import type { ContractStatus } from '@/types/db';

type RosterRow = {
  rowKey: string;
  listKey: string;
  listLabel: string;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  billingCompany: string;
  billingContactName: string;
  billingEmail: string;
  billingCity: string;
  billingState: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryPhone: string;
  importerName: string;
  importerEmail: string;
  wineName: string;
  vintage: string;
  contractId: string | null;
  contractStatus: ContractStatus | null;
  sheetStatus: string | null;
  sheetLastUpdated: string | null;
  sheetFields: { label: string; value: string }[];
};

type RosterSheet = {
  key: string;
  label: string;
  count: number;
};

type RosterPayload = {
  syncedAt: string;
  fromCache?: boolean;
  event: { id: string; name: string; client_send_enabled: boolean };
  sheets: RosterSheet[];
  rows: RosterRow[];
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;

const COLUMN_MODES: RosterColumnMode[] = ['essential', 'extended', 'all'];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'not_started', label: 'Not in system' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent / signing' },
  { key: 'done', label: 'Signed / executed' },
] as const;

function matchesFilter(row: RosterRow, filter: string): boolean {
  const status = row.contractStatus;
  switch (filter) {
    case 'not_started':
      return !row.contractId;
    case 'in_progress':
      return Boolean(status && ['draft', 'ready_for_review', 'pending_events_review'].includes(status));
    case 'approved':
      return status === 'approved';
    case 'sent':
      return Boolean(status && ['sent', 'partially_signed'].includes(status));
    case 'done':
      return Boolean(status && ['signed', 'executed'].includes(status));
    default:
      return true;
  }
}

function sheetFieldValue(row: RosterRow, label: string): string {
  const normalized = label.trim();
  const hit = row.sheetFields?.find((f) => f.label.trim() === normalized);
  return hit?.value ?? '';
}

function CellText({ value, className }: { value: string; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('block max-w-[16rem] truncate', className)} title={value}>
      {value}
    </span>
  );
}

function renderUiCell(row: RosterRow, columnId: string) {
  switch (columnId) {
    case 'winery':
      return <CellText value={row.wineryName} className="font-medium" />;
    case 'list':
      return <span className={rosterListBadgeClass(row.listKey)}>{row.listLabel}</span>;
    case 'wine':
      return <CellText value={[row.wineName, row.vintage].filter(Boolean).join(' · ')} />;
    case 'signer':
      return (
        <div className="min-w-0">
          <CellText value={row.signerName} />
          {row.signerEmail ? (
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground" title={row.signerEmail}>
              {row.signerEmail}
            </span>
          ) : null}
        </div>
      );
    case 'licenseStatus':
      return row.contractStatus ? (
        <StatusBadge status={row.contractStatus} />
      ) : (
        <span className="text-sm text-muted-foreground">Not started</span>
      );
    case 'billingCompany':
      return <CellText value={row.billingCompany} />;
    case 'billingContact':
      return (
        <div className="min-w-0">
          <CellText value={row.billingContactName} />
          {row.billingEmail ? (
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground" title={row.billingEmail}>
              {row.billingEmail}
            </span>
          ) : null}
        </div>
      );
    case 'primaryContact':
      return (
        <div className="min-w-0">
          <CellText value={row.primaryContactName} />
          {row.primaryContactEmail ? (
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground" title={row.primaryContactEmail}>
              {row.primaryContactEmail}
            </span>
          ) : null}
        </div>
      );
    case 'billingLocation':
      return <CellText value={[row.billingCity, row.billingState].filter(Boolean).join(', ')} />;
    case 'importer':
      return (
        <div className="min-w-0">
          <CellText value={row.importerName} />
          {row.importerEmail ? (
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground" title={row.importerEmail}>
              {row.importerEmail}
            </span>
          ) : null}
        </div>
      );
    case 'sheetStatus':
      return <CellText value={row.sheetStatus ?? ''} className="text-sm text-muted-foreground" />;
    case 'sheetUpdated':
      return <CellText value={row.sheetLastUpdated ?? ''} className="text-sm text-muted-foreground" />;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

export function ExhibitorRosterPanel({ initial }: { initial: RosterPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [listFilter, setListFilter] = useState<string>('all');
  const [filter, setFilter] = useState<string>('all');
  const [columnMode, setColumnMode] = useState<RosterColumnMode>('essential');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showListColumn = listFilter === 'all';
  const uiColumns = useMemo(
    () => visibleUiColumns(columnMode, showListColumn),
    [columnMode, showListColumn],
  );
  const sheetColumns = useMemo(() => visibleSheetColumns(columnMode), [columnMode]);
  const tableColSpan = 2 + (columnMode === 'all' ? sheetColumns.length : uiColumns.length);

  const sheetTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.rows) {
      counts.set(row.listKey, (counts.get(row.listKey) ?? 0) + 1);
    }
    const fromApi = data.sheets ?? [];
    const tabs: RosterSheet[] = fromApi.map((sheet) => ({
      ...sheet,
      count: counts.get(sheet.key) ?? sheet.count ?? 0,
    }));
    if (tabs.length === 0) {
      for (const [key, count] of counts) {
        const label = data.rows.find((r) => r.listKey === key)?.listLabel ?? key;
        tabs.push({ key, label, count });
      }
    }
    return tabs;
  }, [data.rows, data.sheets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (listFilter !== 'all' && row.listKey !== listFilter) return false;
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      const haystack = [
        row.wineryName,
        row.signerName,
        row.signerEmail,
        row.wineName,
        row.vintage,
        row.billingCompany,
        row.billingEmail,
        row.primaryContactName,
        row.primaryContactEmail,
        row.importerName,
        ...(row.sheetFields ?? []).map((f) => `${f.label} ${f.value}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data.rows, filter, listFilter, search]);

  const refresh = useCallback(
    (options?: { live?: boolean; preserveSelection?: boolean }) => {
      startTransition(async () => {
        setMessage(null);
        const url = options?.live ? '/api/wine-spectator/roster?live=1' : '/api/wine-spectator/roster';
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(json.error ?? 'Refresh failed');
          return;
        }
        setData(json as RosterPayload);
        if (!options?.preserveSelection) setSelected(new Set());
        router.refresh();
      });
    },
    [router],
  );

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      refresh({ preserveSelection: true });
    };
    const id = window.setInterval(tick, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const toggleRow = (rowKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const keys = filtered.map((r) => r.rowKey);
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const createSelected = () => {
    const items = data.rows
      .filter((r) => selected.has(r.rowKey) && !r.contractId)
      .map((r) => ({ rowKey: r.rowKey, listKey: r.listKey }));
    if (items.length === 0) {
      setMessage('Select exhibitors without a license to create drafts.');
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const res = await fetch('/api/wine-spectator/roster/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? 'Create failed');
        return;
      }
      const created = (json.created ?? []).length;
      const skipped = (json.skipped ?? []).length;
      const errors = (json.errors ?? []).length;
      setMessage(`Created ${created} draft${created === 1 ? '' : 's'} · skipped ${skipped} · errors ${errors}`);
      await refresh({ live: true, preserveSelection: true });
    });
  };

  const sendSelected = () => {
    if (!data.event.client_send_enabled) {
      setMessage('Client send is disabled for this event.');
      return;
    }
    const ids = data.rows.filter((r) => selected.has(r.rowKey) && r.contractStatus === 'approved' && r.contractId).map((r) => r.contractId!);
    if (ids.length === 0) {
      setMessage('Select approved licenses to send.');
      return;
    }
    startTransition(async () => {
      setMessage(null);
      let sent = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await fetch(`/api/contracts/${id}/send`, { method: 'POST' });
        if (res.ok) sent += 1;
        else failed += 1;
      }
      setMessage(`Sent ${sent} · failed ${failed}`);
      await refresh({ live: true, preserveSelection: true });
    });
  };

  const selectedCreatable = data.rows.filter((r) => selected.has(r.rowKey) && !r.contractId).length;
  const selectedSendable = data.rows.filter((r) => selected.has(r.rowKey) && r.contractStatus === 'approved').length;

  return (
    <div className="space-y-4">
      {!data.event.client_send_enabled ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-sm text-amber-950">
          Client send is disabled — create and approve licenses internally. Status still writes back to Google Sheets.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => refresh({ live: true })} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh from sheets
        </Button>
        <Button size="sm" onClick={createSelected} disabled={pending || selectedCreatable === 0}>
          <FilePlus2 className="h-4 w-4" />
          Create drafts ({selectedCreatable})
        </Button>
        <Button size="sm" variant="secondary" onClick={sendSelected} disabled={pending || selectedSendable === 0 || !data.event.client_send_enabled}>
          <Send className="h-4 w-4" />
          Send selected ({selectedSendable})
        </Button>
        <span className="text-xs text-muted-foreground">
          {data.fromCache ? 'Auto-synced' : 'Live from sheets'} {formatRelative(data.syncedAt)} · {filtered.length} shown
          {listFilter === 'all' ? ` · ${data.rows.length} total` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exhibitor list</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={listFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setListFilter('all')}
          >
            All lists ({data.rows.length})
          </Button>
          {sheetTabs.map((sheet) => {
            const accent = rosterListStyle(sheet.key);
            const active = listFilter === sheet.key;
            return (
              <Button
                key={sheet.key}
                size="sm"
                variant="outline"
                className={cn(active ? accent.buttonActive : accent.buttonIdle)}
                onClick={() => setListFilter(sheet.key)}
              >
                <span className={cn('mr-2 inline-block h-2 w-2 rounded-full', accent.legendDot)} aria-hidden />
                {sheet.label} ({sheet.count})
              </Button>
            );
          })}
        </div>
        {listFilter === 'all' ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {sheetTabs.map((sheet) => (
              <span key={sheet.key} className="inline-flex items-center gap-1.5">
                <span className={cn('inline-block h-2 w-2 rounded-full', rosterListStyle(sheet.key).legendDot)} aria-hidden />
                {sheet.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">License status</p>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? 'default' : 'outline'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search winery, signer, billing, sheet fields…"
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Columns3 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Columns</p>
          {COLUMN_MODES.map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={columnMode === mode ? 'default' : 'outline'}
              onClick={() => setColumnMode(mode)}
            >
              {rosterColumnModeLabel(mode)}
            </Button>
          ))}
        </div>
        {columnMode === 'all' ? (
          <p className="text-xs text-muted-foreground">Scroll horizontally to see every field from the Google Sheet form.</p>
        ) : columnMode === 'essential' ? (
          <p className="text-xs text-muted-foreground">Showing winery, wine, contract signer, and license status. Switch to More columns or All sheet fields for full detail.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Showing billing, contacts, and sheet sync status in addition to essentials.</p>
        )}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table className={columnMode === 'all' ? 'min-w-max text-xs' : undefined}>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 w-10 bg-background">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={filtered.length > 0 && filtered.every((r) => selected.has(r.rowKey))}
                  onChange={toggleAllVisible}
                />
              </TableHead>
              {columnMode === 'all'
                ? sheetColumns.map((label) => (
                    <TableHead key={label} className="min-w-[9rem] max-w-[14rem] whitespace-normal text-[10px] leading-snug">
                      {label.trim()}
                    </TableHead>
                  ))
                : uiColumns.map((col) => (
                    <TableHead key={col.id} style={{ minWidth: col.minWidth }}>
                      {col.label}
                    </TableHead>
                  ))}
              <TableHead className="sticky right-0 z-10 bg-background text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="py-10 text-center text-sm text-muted-foreground">
                  No exhibitors match this list and filter.
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((row) => (
              <TableRow
                key={row.rowKey}
                className={rosterListRowClass(row.listKey, listFilter === 'all')}
              >
                <TableCell className="sticky left-0 z-10 bg-inherit">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.wineryName}`}
                    checked={selected.has(row.rowKey)}
                    onChange={() => toggleRow(row.rowKey)}
                  />
                </TableCell>
                {columnMode === 'all'
                  ? sheetColumns.map((label) => (
                      <TableCell key={`${row.rowKey}-${label}`} className="align-top">
                        <CellText value={sheetFieldValue(row, label)} className="text-xs" />
                      </TableCell>
                    ))
                  : uiColumns.map((col) => (
                      <TableCell key={col.id} className="align-top">
                        {renderUiCell(row, col.id)}
                      </TableCell>
                    ))}
                <TableCell className="sticky right-0 z-10 bg-inherit text-right">
                  {row.contractId ? (
                    <Link href={`/wine-spectator/contracts/${row.contractId}`} className="text-sm font-medium text-accent-brand hover:underline">
                      Open
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent-brand hover:underline"
                      disabled={pending}
                      onClick={() => {
                        setSelected(new Set([row.rowKey]));
                        createSelected();
                      }}
                    >
                      Create
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
