'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileUp,
  Link2,
  Loader2,
  Plus,
  Sheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import type {
  ParticipationLinkableContract,
  ParticipationReport,
  ParticipationReportRow,
} from '@/lib/participation-report-shared';
import { companiesMatch } from '@/lib/participation-report-shared';

type SortKey = 'company_name' | 'booth_count' | 'total_spend_cents' | 'sales_rep_initials';
type SectionTone = 'confirmed' | 'pending' | 'new';

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

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('executed') || s.includes('manual upload')) return 'bg-emerald-950/10 text-emerald-900';
  if (s.includes('signed') || s.includes('progress') || s.includes('sent')) return 'bg-amber-950/10 text-amber-950';
  if (s.includes('no contract')) return 'bg-stone-900/5 text-stone-600';
  return 'bg-stone-900/5 text-stone-700';
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
        'inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground',
        active && 'text-foreground',
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
  subtitle,
  tone,
  rows,
  showNotes,
  showConvert,
  onNotesSave,
  linkableContracts,
  onLinkContract,
  onManualUploadToggle,
  sortKey,
  sortDir,
  onSort,
  headerAction,
}: {
  title: string;
  subtitle?: string;
  tone: SectionTone;
  rows: ParticipationReportRow[];
  showNotes: boolean;
  showConvert?: boolean;
  onNotesSave?: (targetId: string, notes: string) => Promise<void>;
  linkableContracts?: ParticipationLinkableContract[];
  onLinkContract?: (targetId: string, contractId: string | null) => Promise<void>;
  onManualUploadToggle?: (targetId: string, received: boolean) => Promise<void>;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  headerAction?: ReactNode;
}) {
  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const booths = rows.reduce((a, r) => a + (r.booth_count || 0), 0);
  const spend = rows.reduce((a, r) => a + (r.total_spend_cents || 0), 0);
  const colSpan = (showNotes ? 8 : 7) + (showConvert ? 1 : 0);

  const bar =
    tone === 'confirmed'
      ? 'bg-emerald-800'
      : tone === 'pending'
        ? 'bg-[hsl(var(--accent-brand))]'
        : 'bg-[#182d6d]';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className={cn('h-8 w-1.5 shrink-0 rounded-full', bar)} aria-hidden />
            <h2 className="font-display text-3xl font-medium tracking-tight text-foreground">{title}</h2>
          </div>
          <p className="pl-5 text-sm text-muted-foreground">
            {subtitle ?? `${rows.length} companies · ${booths} booths · ${money(spend)}`}
          </p>
        </div>
        {headerAction}
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-bg-surface/80 shadow-[0_1px_0_rgba(40,28,12,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-bg-surface-raised/90">
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Rep" sortKey="sales_rep_initials" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                </th>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Company" sortKey="company_name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Brands
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Booths"
                    sortKey="booth_count"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                    className="justify-end"
                  />
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Rate
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Spons.
                </th>
                <th className="px-4 py-3 text-right">
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
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Notes
                  </th>
                ) : null}
                {showConvert ? (
                  <th className="min-w-[220px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Manage
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
                    No companies in this section yet.
                  </td>
                </tr>
              ) : (
                sorted.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border/40 align-top last:border-0 transition-colors hover:bg-amber-950/[0.03]',
                      i % 2 === 1 && 'bg-stone-900/[0.015]',
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex min-w-[2.25rem] justify-center rounded-md bg-stone-900/5 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-foreground">
                        {row.sales_rep_initials}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.contract_id ? (
                        <Link
                          href={`/contracts/${row.contract_id}`}
                          className="font-medium text-foreground underline decoration-[hsl(var(--accent-brand)/0.35)] underline-offset-2 transition-colors hover:text-[hsl(var(--accent-brand))]"
                        >
                          {row.company_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{row.company_name}</span>
                      )}
                      {row.manual_upload_received ? (
                        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-800">
                          <Check className="h-3 w-3" /> Manual PDF received
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-muted-foreground leading-snug">
                      {row.brands_text || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{row.booth_count || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.rate_per_booth_cents ? money(row.rate_per_booth_cents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {row.sponsorship_label || 'N'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {money(row.total_spend_cents)}
                    </td>
                    {showNotes ? (
                      <td className="min-w-[200px] max-w-[280px] px-4 py-3">
                        <span
                          className={cn(
                            'mb-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                            statusTone(row.pipeline_status),
                          )}
                        >
                          {row.pipeline_status}
                        </span>
                        {row.sheet_notes ? (
                          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{row.sheet_notes}</p>
                        ) : (
                          <p className="mb-2 text-xs italic text-muted-foreground/70">No sheet notes</p>
                        )}
                        {row.target_id && onNotesSave ? (
                          <NotesEditor targetId={row.target_id} initial={row.notes} onSave={onNotesSave} />
                        ) : row.notes ? (
                          <p className="text-xs text-foreground">{row.notes}</p>
                        ) : null}
                      </td>
                    ) : null}
                    {showConvert ? (
                      <td className="px-4 py-3">
                        {row.target_id && onLinkContract && onManualUploadToggle && linkableContracts ? (
                          <PipelineActions
                            row={row}
                            linkableContracts={linkableContracts}
                            onLinkContract={onLinkContract}
                            onManualUploadToggle={onManualUploadToggle}
                          />
                        ) : row.contract_id ? (
                          <Button asChild type="button" size="sm" variant="outline">
                            <Link href={`/contracts/${row.contract_id}`}>Open contract</Link>
                          </Button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/70 bg-bg-surface-raised/95">
                <td className="px-4 py-3 font-display text-base font-medium" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{booths}</td>
                <td colSpan={2} />
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(spend)}</td>
                {showNotes ? <td /> : null}
                {showConvert ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}

function PipelineActions({
  row,
  linkableContracts,
  onLinkContract,
  onManualUploadToggle,
}: {
  row: ParticipationReportRow;
  linkableContracts: ParticipationLinkableContract[];
  onLinkContract: (targetId: string, contractId: string | null) => Promise<void>;
  onManualUploadToggle: (targetId: string, received: boolean) => Promise<void>;
}) {
  const targetId = row.target_id!;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const suggested = useMemo(() => {
    return linkableContracts
      .filter((c) => companiesMatch(row.company_name, c.company_name))
      .sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [linkableContracts, row.company_name]);

  const others = useMemo(() => {
    const suggestedIds = new Set(suggested.map((c) => c.id));
    return linkableContracts
      .filter((c) => !suggestedIds.has(c.id))
      .sort((a, b) => a.company_name.localeCompare(b.company_name));
  }, [linkableContracts, suggested]);

  function patchLink(contractId: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await onLinkContract(targetId, contractId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Link failed');
      }
    });
  }

  function toggleManual(checked: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await onManualUploadToggle(targetId, checked);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed');
      }
    });
  }

  return (
    <div className="space-y-2 text-left">
      <div className="flex flex-wrap gap-1.5">
        {row.contract_id ? (
          <Button asChild type="button" size="sm" variant="outline" className="h-8">
            <Link href={`/contracts/${row.contract_id}`}>Open</Link>
          </Button>
        ) : (
          <Button asChild type="button" size="sm" className="h-8">
            <Link href={`/contracts/new?fromPipeline=${targetId}`}>Convert</Link>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          More
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-bg-page/80 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="flex flex-wrap gap-1.5">
            {row.contract_id ? (
              <Button asChild type="button" size="sm" variant="outline" className="h-8">
                <Link href={`/contracts/new?fromPipeline=${targetId}`}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  New draft
                </Link>
              </Button>
            ) : null}
            <Button asChild type="button" size="sm" variant="outline" className="h-8">
              <Link href={`/contracts/import?fromPipeline=${targetId}`}>
                <FileUp className="h-3.5 w-3.5" />
                Import PDF
              </Link>
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Link2 className="h-3 w-3" />
              Link existing
            </label>
            <select
              className="w-full rounded-md border border-border/60 bg-bg-surface px-2.5 py-2 text-xs text-foreground disabled:opacity-60"
              value={row.contract_id ?? ''}
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                patchLink(v ? v : null);
              }}
            >
              <option value="">— Not linked —</option>
              {suggested.length > 0 ? (
                <optgroup label="Likely matches">
                  {suggested.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} · {c.status} · {money(c.total_cents)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={suggested.length ? 'All event contracts' : 'Event contracts'}>
                {(suggested.length ? others : linkableContracts).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} · {c.status} · {money(c.total_cents)}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border accent-[hsl(var(--accent-brand))]"
              checked={row.manual_upload_received}
              disabled={pending}
              onChange={(e) => toggleManual(e.target.checked)}
            />
            Manual upload received
          </label>

          {pending ? (
            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </p>
          ) : null}
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
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
    <div className="space-y-1.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-md border border-border/50 bg-bg-page/70 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[hsl(var(--accent-brand)/0.5)] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent-brand)/0.35)]"
        placeholder="Portal notes…"
      />
      {dirty ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await onSave(targetId, value);
            })
          }
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
      ) : null}
    </div>
  );
}

function SummaryStat({
  label,
  booths,
  spend,
  tone,
}: {
  label: string;
  booths: number;
  spend: number;
  tone: SectionTone;
}) {
  const bar =
    tone === 'confirmed'
      ? 'from-emerald-800/15 via-transparent to-transparent'
      : tone === 'pending'
        ? 'from-[hsl(34_62%_49%/0.18)] via-transparent to-transparent'
        : 'from-[hsl(222_58%_30%/0.12)] via-transparent to-transparent';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-bg-surface px-5 py-4',
        'bg-gradient-to-br',
        bar,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums tracking-tight text-foreground">
        {booths}
        <span className="ml-2 text-base font-normal text-muted-foreground">booths</span>
      </p>
      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{money(spend)}</p>
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

  async function linkContract(targetId: string, contractId: string | null) {
    const res = await fetch('/api/reports/participation/targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: targetId,
        linked_contract_id: contractId,
      }),
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
      setExportMsg(
        `Created “${json.title ?? 'Participation Status'}” in Google Sheets (shared with you as editor).`,
      );
    } catch {
      setExportMsg('Export failed — check your connection.');
    } finally {
      setExporting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportMsg(null);
    setSheetUrl(null);
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

  async function exportExcel() {
    setExporting(true);
    setExportMsg(null);
    setSheetUrl(null);
    try {
      const res = await fetch('/api/reports/participation/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'xlsx', eventId: report.event.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setExportMsg(json.error ?? 'Excel export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wf-ny-${report.event.year}-participation.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg('Excel file downloaded.');
    } catch {
      setExportMsg('Excel export failed.');
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
    <div className="relative space-y-12">
      <div
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(182,125,45,0.12),_transparent_55%)]"
        aria-hidden
      />

      <header className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent-brand))]">
            WhiskyFest · {report.event.year}
          </p>
          <h1 className="font-display text-5xl font-medium tracking-tight text-foreground sm:text-6xl">
            Participation
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Confirmed from executed contracts. Pending and new business sync from the WhiskyFest &amp; Tequila
            2026 sheet.
          </p>
          {report.sheetsFetchedAt ? (
            <p className="text-xs text-muted-foreground/80">
              Sheet synced {new Date(report.sheetsFetchedAt).toLocaleString()}
              {report.sheetsFromCache ? ' · cached (~5 min)' : ' · live'}
              {report.sheetsError ? ` · ${report.sheetsError}` : ''}
            </p>
          ) : report.sheetsError ? (
            <p className="text-xs text-destructive">{report.sheetsError}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Excel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV
            </Button>
            <Button type="button" size="sm" onClick={exportSheets} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
              Google Sheets
            </Button>
          </div>
          {exportMsg ? (
            <p className="max-w-sm text-right text-xs text-muted-foreground">
              {exportMsg}{' '}
              {sheetUrl ? (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[hsl(var(--accent-brand))] hover:underline"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      <div className="relative grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Confirmed"
          booths={report.totals.confirmedBooths}
          spend={report.totals.confirmedSpendCents}
          tone="confirmed"
        />
        <SummaryStat
          label="Pending renewals"
          booths={report.totals.pendingBooths}
          spend={report.totals.pendingSpendCents}
          tone="pending"
        />
        <SummaryStat
          label="Confirmed + Pending"
          booths={report.totals.confirmedPlusPendingBooths}
          spend={report.totals.confirmedPlusPendingSpendCents}
          tone="new"
        />
      </div>

      <SectionTable
        title="Confirmed"
        tone="confirmed"
        rows={report.confirmed}
        showNotes={false}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />

      <SectionTable
        title="Pending renewals"
        tone="pending"
        subtitle={`${report.pending.length} companies · ${report.totals.pendingBooths} booths · ${money(report.totals.pendingSpendCents)} · Convert, import PDF, or link an existing contract`}
        rows={report.pending}
        showNotes
        showConvert
        onNotesSave={saveNotes}
        linkableContracts={report.linkableContracts ?? []}
        onLinkContract={linkContract}
        onManualUploadToggle={setManualUpload}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
      />

      <SectionTable
        title="New business"
        tone="new"
        subtitle={`${report.newBusiness.length} inquiries · track outreach, convert, or import when signed`}
        rows={report.newBusiness}
        showNotes
        showConvert
        onNotesSave={saveNotes}
        linkableContracts={report.linkableContracts ?? []}
        onLinkContract={linkContract}
        onManualUploadToggle={setManualUpload}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        headerAction={
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add inquiry
          </Button>
        }
      />

      {showAdd ? (
        <form
          onSubmit={addInquiry}
          className="grid gap-3 rounded-xl border border-border/70 bg-bg-surface p-5 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
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
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={addPending || !addCompany.trim()}>
              {addPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save inquiry
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
