'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  Download,
  ExternalLink,
  FileUp,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sheet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type {
  ParticipationLinkableContract,
  ParticipationReport,
  ParticipationReportRow,
} from '@/lib/participation-report-shared';
import { companiesMatch } from '@/lib/participation-report-shared';

type SortKey = 'company_name' | 'booth_count' | 'total_spend_cents' | 'sales_rep_initials';
type TabId = 'confirmed' | 'pending' | 'new_business';

function money(cents: number): string {
  return formatCurrency(cents, { showCents: false });
}

function sortRows(rows: ParticipationReportRow[], key: SortKey, dir: 'asc' | 'desc') {
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
    return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' }) * mul;
  });
}

function truncate(text: string, max = 48): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground',
        align === 'right' && 'w-full justify-end',
        active && 'text-foreground',
      )}
    >
      {label}
      {active ? (dir === 'asc' ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpAZ className="h-3 w-3" />) : null}
    </button>
  );
}

function RowMenu({
  row,
  linkableContracts,
  onLinkContract,
  onManualUploadToggle,
  onNotesSave,
}: {
  row: ParticipationReportRow;
  linkableContracts: ParticipationLinkableContract[];
  onLinkContract: (targetId: string, contractId: string | null) => Promise<void>;
  onManualUploadToggle: (targetId: string, received: boolean) => Promise<void>;
  onNotesSave: (targetId: string, notes: string) => Promise<void>;
}) {
  const targetId = row.target_id;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(row.notes);
  const [error, setError] = useState<string | null>(null);

  const suggested = useMemo(() => {
    return linkableContracts
      .filter((c) => companiesMatch(row.company_name, c.company_name))
      .sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [linkableContracts, row.company_name]);

  const others = useMemo(() => {
    const ids = new Set(suggested.map((c) => c.id));
    return linkableContracts.filter((c) => !ids.has(c.id)).sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [linkableContracts, suggested]);

  if (!targetId) {
    if (!row.contract_id) return null;
    return (
      <Button asChild type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
        <Link href={`/contracts/${row.contract_id}`}>Open</Link>
      </Button>
    );
  }

  return (
    <div className="relative flex justify-end">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        aria-label="Manage row"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-8 z-30 w-72 rounded-lg border border-border bg-bg-surface p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Manage</p>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-1.5">
              {row.contract_id ? (
                <Button asChild type="button" size="sm" variant="outline" className="h-8 justify-start">
                  <Link href={`/contracts/${row.contract_id}`}>Open contract</Link>
                </Button>
              ) : null}
              <Button asChild type="button" size="sm" variant={row.contract_id ? 'outline' : 'default'} className="h-8 justify-start">
                <Link href={`/contracts/new?fromPipeline=${targetId}`}>Convert (DocuSign)</Link>
              </Button>
              <Button asChild type="button" size="sm" variant="outline" className="h-8 justify-start">
                <Link href={`/contracts/import?fromPipeline=${targetId}`}>
                  <FileUp className="h-3.5 w-3.5" />
                  Import signed PDF
                </Link>
              </Button>
            </div>

            <div className="mt-3 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Link existing
              </label>
              <select
                className="w-full rounded-md border border-border/70 bg-bg-page px-2 py-1.5 text-xs"
                value={row.contract_id ?? ''}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await onLinkContract(targetId, v || null);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Link failed');
                    }
                  });
                }}
              >
                <option value="">— Not linked —</option>
                {suggested.length ? (
                  <optgroup label="Likely matches">
                    {suggested.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} · {c.status}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label={suggested.length ? 'All contracts' : 'Event contracts'}>
                  {(suggested.length ? others : linkableContracts).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} · {c.status}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[hsl(var(--accent-brand))]"
                checked={row.manual_upload_received}
                disabled={pending}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setError(null);
                  startTransition(async () => {
                    try {
                      await onManualUploadToggle(targetId, checked);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Update failed');
                    }
                  });
                }}
              />
              Manual upload received
            </label>

            <div className="mt-3 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Portal notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-md border border-border/70 bg-bg-page px-2 py-1.5 text-xs"
                placeholder="Optional…"
              />
              {notes !== row.notes ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await onNotesSave(targetId, notes);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Save failed');
                      }
                    })
                  }
                >
                  {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Save notes
                </Button>
              ) : null}
            </div>

            {row.sheet_notes ? (
              <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground/70">Sheet: </span>
                {row.sheet_notes}
              </p>
            ) : null}

            {pending ? (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </p>
            ) : null}
            {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ParticipationReportClient({ initial }: { initial: ParticipationReport }) {
  const [report, setReport] = useState(initial);
  const [tab, setTab] = useState<TabId>('pending');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('company_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addCompany, setAddCompany] = useState('');
  const [addRepId, setAddRepId] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const tabs: { id: TabId; label: string; count: number; booths: number; spend: number }[] = [
    {
      id: 'confirmed',
      label: 'Confirmed',
      count: report.confirmed.length,
      booths: report.totals.confirmedBooths,
      spend: report.totals.confirmedSpendCents,
    },
    {
      id: 'pending',
      label: 'Pending',
      count: report.pending.length,
      booths: report.totals.pendingBooths,
      spend: report.totals.pendingSpendCents,
    },
    {
      id: 'new_business',
      label: 'New business',
      count: report.newBusiness.length,
      booths: report.newBusiness.reduce((a, r) => a + (r.booth_count || 0), 0),
      spend: report.newBusiness.reduce((a, r) => a + (r.total_spend_cents || 0), 0),
    },
  ];

  const activeRows = useMemo(() => {
    const base =
      tab === 'confirmed' ? report.confirmed : tab === 'pending' ? report.pending : report.newBusiness;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (r) =>
            r.company_name.toLowerCase().includes(q) ||
            r.brands_text.toLowerCase().includes(q) ||
            r.sales_rep_initials.toLowerCase().includes(q) ||
            r.sheet_notes.toLowerCase().includes(q) ||
            r.notes.toLowerCase().includes(q),
        )
      : base;
    return sortRows(filtered, sortKey, sortDir);
  }, [tab, report, query, sortKey, sortDir]);

  const showManage = tab !== 'confirmed';
  const activeMeta = tabs.find((t) => t.id === tab)!;

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'company_name' || key === 'sales_rep_initials' ? 'asc' : 'desc');
    }
  }

  async function refresh() {
    const res = await fetch('/api/reports/participation');
    if (!res.ok) return;
    setReport((await res.json()) as ParticipationReport);
  }

  async function saveNotes(targetId: string, notes: string) {
    const res = await fetch('/api/reports/participation/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetId, notes }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? 'Failed to save notes');
    }
    await refresh();
  }

  async function linkContract(targetId: string, contractId: string | null) {
    const res = await fetch('/api/reports/participation/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetId, linked_contract_id: contractId }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(typeof j.error === 'string' ? j.error : 'Failed to link contract');
    }
    await refresh();
  }

  async function setManualUpload(targetId: string, received: boolean) {
    const res = await fetch('/api/reports/participation/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetId, manual_upload_received: received }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(typeof j.error === 'string' ? j.error : 'Failed to update flag');
    }
    await refresh();
  }

  async function runExport(format: 'csv' | 'xlsx' | 'sheets') {
    setExporting(true);
    setExportMsg(null);
    setSheetUrl(null);
    try {
      const res = await fetch('/api/reports/participation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, eventId: report.event.id }),
      });
      if (format === 'sheets') {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setExportMsg(json.error ?? 'Export failed');
          return;
        }
        setSheetUrl(json.webViewLink ?? null);
        setExportMsg(`Created “${json.title ?? 'Participation Status'}” (shared with you).`);
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setExportMsg(json.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wf-ny-${report.event.year}-participation.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(format === 'xlsx' ? 'Excel downloaded.' : 'CSV downloaded.');
    } catch {
      setExportMsg('Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function addInquiry(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddPending(true);
    try {
      const res = await fetch('/api/reports/participation/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: report.event.id,
          section: 'new_business',
          companyName: addCompany.trim(),
          salesRepId: addRepId || null,
          notes: addNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(typeof json.error === 'string' ? json.error : 'Could not add inquiry');
        return;
      }
      setAddCompany('');
      setAddNotes('');
      setShowAdd(false);
      setTab('new_business');
      await refresh();
    } finally {
      setAddPending(false);
    }
  }

  return (
    <div className="relative -mx-6 w-[calc(100%+3rem)] space-y-5 px-6 lg:-mx-10 lg:w-[calc(100%+5rem)] lg:px-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent-brand))]">
            WhiskyFest {report.event.year}
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Participation
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.totals.confirmedPlusPendingBooths} booths confirmed + pending · {money(report.totals.confirmedPlusPendingSpendCents)}
            {report.sheetsFetchedAt
              ? ` · sheet ${report.sheetsFromCache ? 'cached' : 'live'} ${new Date(report.sheetsFetchedAt).toLocaleString()}`
              : ''}
            {report.sheetsError ? ` · ${report.sheetsError}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="h-8" disabled={exporting} onClick={() => runExport('xlsx')}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Excel
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8" disabled={exporting} onClick={() => runExport('csv')}>
            CSV
          </Button>
          <Button type="button" size="sm" className="h-8" disabled={exporting} onClick={() => runExport('sheets')}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sheet className="h-3.5 w-3.5" />}
            Sheets
          </Button>
        </div>
      </div>

      {exportMsg ? (
        <p className="text-xs text-muted-foreground">
          {exportMsg}{' '}
          {sheetUrl ? (
            <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[hsl(var(--accent-brand))] hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </p>
      ) : null}

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === t.id
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:bg-stone-900/5 hover:text-foreground',
              )}
            >
              <span className="font-medium">{t.label}</span>
              <span className={cn('ml-1.5 tabular-nums text-xs', tab === t.id ? 'text-background/70' : 'text-muted-foreground')}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, brand, rep…"
              className="h-8 w-full rounded-md border border-border/70 bg-bg-surface pl-8 pr-3 text-sm outline-none focus:border-[hsl(var(--accent-brand)/0.5)] focus:ring-1 focus:ring-[hsl(var(--accent-brand)/0.3)]"
            />
          </div>
          {tab === 'new_business' ? (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Inquiry
            </Button>
          ) : null}
        </div>
      </div>

      {showAdd ? (
        <form onSubmit={addInquiry} className="grid gap-2 rounded-lg border border-border/70 bg-bg-surface p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Input value={addCompany} onChange={(e) => setAddCompany(e.target.value)} required placeholder="Company" className="h-8" />
          <select
            value={addRepId}
            onChange={(e) => setAddRepId(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Rep —</option>
            {report.salesReps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Notes" className="h-8" />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" className="h-8" disabled={addPending || !addCompany.trim()}>
              {addPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
          {addError ? <p className="text-xs text-destructive sm:col-span-4">{addError}</p> : null}
        </form>
      ) : null}

      {/* Compact table */}
      <div className="overflow-hidden rounded-lg border border-border/70 bg-bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-bg-surface-raised/80 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeMeta.label}</span>
            {' · '}
            {activeRows.length}
            {query ? ` match${activeRows.length === 1 ? '' : 'es'}` : ' companies'}
            {' · '}
            {activeMeta.booths} booths · {money(activeMeta.spend)}
          </p>
          {tab === 'pending' ? (
            <p className="hidden text-[11px] text-muted-foreground sm:block">⋯ opens Convert / Import PDF / link</p>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left">
                <th className="w-14 px-3 py-2">
                  <SortHeader label="Rep" sortKey="sales_rep_initials" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                </th>
                <th className="min-w-[160px] px-3 py-2">
                  <SortHeader label="Company" sortKey="company_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                </th>
                <th className="min-w-[180px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Brands
                </th>
                <th className="w-16 px-3 py-2 text-right">
                  <SortHeader label="#" sortKey="booth_count" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                </th>
                <th className="w-24 px-3 py-2 text-right">
                  <SortHeader label="Total" sortKey="total_spend_cents" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                </th>
                {showManage ? (
                  <th className="min-w-[140px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Status / notes
                  </th>
                ) : null}
                {showManage ? (
                  <th className="w-12 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {' '}
                  </th>
                ) : (
                  <th className="w-16 px-2 py-2" />
                )}
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={showManage ? 7 : 6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {query ? 'No matches.' : 'Nothing in this section yet.'}
                  </td>
                </tr>
              ) : (
                activeRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-amber-950/[0.025]">
                    <td className="px-3 py-1.5 align-middle">
                      <span className="text-xs font-semibold tracking-wide text-foreground">{row.sales_rep_initials}</span>
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <div className="flex items-center gap-1.5">
                        {row.contract_id ? (
                          <Link
                            href={`/contracts/${row.contract_id}`}
                            className="font-medium text-foreground hover:text-[hsl(var(--accent-brand))] hover:underline"
                          >
                            {row.company_name}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{row.company_name}</span>
                        )}
                        {row.manual_upload_received ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-label="Manual upload received" />
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-[220px] px-3 py-1.5 align-middle text-xs text-muted-foreground" title={row.brands_text || undefined}>
                      {row.brands_text ? truncate(row.brands_text, 56) : '—'}
                    </td>
                    <td className="px-3 py-1.5 align-middle text-right tabular-nums">{row.booth_count || '—'}</td>
                    <td className="px-3 py-1.5 align-middle text-right tabular-nums font-medium">{money(row.total_spend_cents)}</td>
                    {showManage ? (
                      <td className="max-w-[180px] px-3 py-1.5 align-middle">
                        <p className="truncate text-[11px] text-muted-foreground">{row.pipeline_status}</p>
                        {(row.sheet_notes || row.notes) && (
                          <p
                            className="truncate text-[11px] text-muted-foreground/80"
                            title={[row.sheet_notes, row.notes].filter(Boolean).join(' · ')}
                          >
                            {truncate(row.sheet_notes || row.notes, 40)}
                          </p>
                        )}
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 align-middle text-right">
                      {showManage ? (
                        <RowMenu
                          row={row}
                          linkableContracts={report.linkableContracts ?? []}
                          onLinkContract={linkContract}
                          onManualUploadToggle={setManualUpload}
                          onNotesSave={saveNotes}
                        />
                      ) : row.contract_id ? (
                        <Button asChild type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Link href={`/contracts/${row.contract_id}`}>Open</Link>
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!query && activeRows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border/60 bg-bg-surface-raised/70">
                  <td className="px-3 py-2 text-xs font-semibold" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{activeMeta.booths}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{money(activeMeta.spend)}</td>
                  {showManage ? <td /> : null}
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {tab === 'confirmed' ? (
        <p className="text-[11px] text-muted-foreground">
          Confirmed = executed contracts only. Pending renewals and new business stay on their tabs until signed/executed.
        </p>
      ) : null}
    </div>
  );
}
