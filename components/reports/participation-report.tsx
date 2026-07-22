'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowDownAZ, ArrowUpAZ, Download, ExternalLink, Loader2, Plus, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type { ParticipationReport, ParticipationReportRow } from '@/lib/participation-report-shared';

type SortKey = 'company_name' | 'booth_count' | 'total_spend_cents' | 'sales_rep_initials';

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

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {label}
      {active ? (dir === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />) : null}
    </button>
  );
}

function SectionTable({
  title,
  rows,
  showNotes,
  showConvert,
  onNotesSave,
  sortKey,
  sortDir,
  onSort,
}: {
  title: string;
  rows: ParticipationReportRow[];
  showNotes: boolean;
  showConvert?: boolean;
  onNotesSave?: (targetId: string, notes: string) => Promise<void>;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const booths = rows.reduce((a, r) => a + (r.booth_count || 0), 0);
  const spend = rows.reduce((a, r) => a + (r.total_spend_cents || 0), 0);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} companies · {booths} booths · {money(spend)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-bg-surface-raised/80">
            <tr className="border-b border-border/60">
              <th className="px-3 py-2.5 text-left">
                <SortHeader label="Rep" sortKey="sales_rep_initials" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5 text-left">
                <SortHeader label="Company" sortKey="company_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Brands
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="Booths"
                  sortKey="booth_count"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="justify-end"
                />
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Rate
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Spons.
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader
                  label="Total"
                  sortKey="total_spend_cents"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="justify-end"
                />
              </th>
              {showNotes ? (
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes / Status
                </th>
              ) : null}
              {showConvert ? (
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Action
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={(showNotes ? 8 : 7) + (showConvert ? 1 : 0)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No rows yet.
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.sales_rep_initials}</td>
                  <td className="px-3 py-2.5">
                    {row.contract_id ? (
                      <Link href={`/contracts/${row.contract_id}`} className="font-medium text-accent-brand hover:underline">
                        {row.company_name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{row.company_name}</span>
                    )}
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5 text-muted-foreground">{row.brands_text || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.booth_count || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.rate_per_booth_cents ? money(row.rate_per_booth_cents) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.sponsorship_label || 'N'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{money(row.total_spend_cents)}</td>
                  {showNotes ? (
                    <td className="min-w-[220px] px-3 py-2.5">
                      <p className="mb-1 text-xs text-muted-foreground">{row.pipeline_status}</p>
                      {row.sheet_notes ? (
                        <p className="mb-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">Notes (WF &amp; Tequila 2026): </span>
                          {row.sheet_notes}
                        </p>
                      ) : (
                        <p className="mb-2 text-xs text-muted-foreground">No notes on sheet</p>
                      )}
                      {row.target_id && onNotesSave ? (
                        <NotesEditor targetId={row.target_id} initial={row.notes} onSave={onNotesSave} />
                      ) : row.notes ? (
                        <p className="text-xs text-foreground">{row.notes}</p>
                      ) : null}
                    </td>
                  ) : null}
                  {showConvert ? (
                    <td className="px-3 py-2.5 text-right">
                      {row.contract_id ? (
                        <Button asChild type="button" size="sm" variant="outline">
                          <Link href={`/contracts/${row.contract_id}`}>Open contract</Link>
                        </Button>
                      ) : row.target_id ? (
                        <Button asChild type="button" size="sm">
                          <Link href={`/contracts/new?fromPipeline=${row.target_id}`}>Convert</Link>
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-bg-surface-raised/60 font-semibold">
              <td className="px-3 py-2.5" colSpan={3}>
                TOTAL
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{booths}</td>
              <td colSpan={2} />
              <td className="px-3 py-2.5 text-right tabular-nums">{money(spend)}</td>
              {showNotes ? <td /> : null}
              {showConvert ? <td /> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function NotesEditor({
  targetId,
  initial,
  onSave,
}: {
  targetId: string;
  initial: string;
  onSave: (targetId: string, notes: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = value !== initial;

  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-md border border-border/60 bg-bg-page px-2 py-1.5 text-xs text-foreground"
        placeholder="Optional portal notes (not from the Google Sheet)…"
      />
      {dirty ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await onSave(targetId, value);
            })
          }
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save portal notes
        </Button>
      ) : null}
    </div>
  );
}

export function ParticipationReportClient({ initial }: { initial: ParticipationReport }) {
  const [report, setReport] = useState(initial);
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
    const json = (await res.json()) as ParticipationReport;
    setReport(json);
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

  async function exportSheets() {
    setExporting(true);
    setExportMsg(null);
    setSheetUrl(null);
    try {
      const res = await fetch('/api/reports/participation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'sheets', eventId: report.event.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExportMsg(json.error ?? 'Export failed');
        return;
      }
      setSheetUrl(json.webViewLink ?? null);
      setExportMsg(`Created “${json.title ?? 'Participation Status'}” in Google Sheets.`);
    } catch {
      setExportMsg('Export failed — check your connection.');
    } finally {
      setExporting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await fetch('/api/reports/participation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'csv', eventId: report.event.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setExportMsg(json.error ?? 'CSV export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wf-ny-${report.event.year}-participation.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('CSV downloaded.');
    } catch {
      setExportMsg('CSV export failed.');
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
      await refresh();
    } finally {
      setAddPending(false);
    }
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            Participation report
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {report.event.name} {report.event.year} — Confirmed from executed contracts. Pending renewals and new
            business (including Notes) pull live from the WhiskyFest &amp; Tequila 2026 sheet on every load. Add your
            own portal notes per company; sort any column and export when Stephen needs the sheet.
          </p>
          {report.sheetsFetchedAt ? (
            <p className="text-xs text-muted-foreground">
              Sheets synced {new Date(report.sheetsFetchedAt).toLocaleString()}
              {report.sheetsError ? ` · Warning: ${report.sheetsError}` : ''}
            </p>
          ) : report.sheetsError ? (
            <p className="text-xs text-destructive">Sheets sync failed: {report.sheetsError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
          <Button type="button" size="sm" onClick={exportSheets} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
            Export to Google Sheets
          </Button>
        </div>
      </header>

      {exportMsg ? (
        <p className="text-sm text-muted-foreground">
          {exportMsg}{' '}
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent-brand hover:underline"
            >
              Open spreadsheet
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-bg-surface-raised/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confirmed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {report.totals.confirmedBooths}{' '}
            <span className="text-base font-normal text-muted-foreground">booths</span>
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">{money(report.totals.confirmedSpendCents)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-bg-surface-raised/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending renewals</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {report.totals.pendingBooths}{' '}
            <span className="text-base font-normal text-muted-foreground">booths</span>
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">{money(report.totals.pendingSpendCents)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-bg-surface-raised/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confirmed + Pending</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {report.totals.confirmedPlusPendingBooths}{' '}
            <span className="text-base font-normal text-muted-foreground">booths</span>
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {money(report.totals.confirmedPlusPendingSpendCents)}
          </p>
        </div>
      </div>

      <SectionTable
        title="Confirmed"
        rows={report.confirmed}
        showNotes={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />

      <SectionTable
        title="Pending renewals"
        rows={report.pending}
        showNotes
        showConvert
        onNotesSave={saveNotes}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div />
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add inquiry
          </Button>
        </div>
        {showAdd ? (
          <form
            onSubmit={addInquiry}
            className="grid gap-3 rounded-lg border border-border/60 bg-bg-surface-raised/30 p-4 sm:grid-cols-2"
          >
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="inq-company">Company</Label>
              <Input
                id="inq-company"
                value={addCompany}
                onChange={(e) => setAddCompany(e.target.value)}
                required
                placeholder="Exhibitor company"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inq-rep">Sales rep</Label>
              <select
                id="inq-rep"
                value={addRepId}
                onChange={(e) => setAddRepId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {report.salesReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="inq-notes">Notes</Label>
              <Input
                id="inq-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Inquiry status, call notes…"
              />
            </div>
            {addError ? <p className="text-sm text-destructive sm:col-span-2">{addError}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" disabled={addPending || !addCompany.trim()}>
                {addPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save inquiry
              </Button>
            </div>
          </form>
        ) : null}
        <SectionTable
          title="New business — inquiry tracking"
          rows={report.newBusiness}
          showNotes
          showConvert
          onNotesSave={saveNotes}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </div>
  );
}
