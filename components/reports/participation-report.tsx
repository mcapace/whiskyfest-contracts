'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  FileUp,
  LayoutList,
  Link2,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
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
type ViewId = TabId | 'all';

const TAB_THEME: Record<
  TabId,
  {
    label: string;
    icon: typeof BadgeCheck;
    accent: string;
    accentSoft: string;
    accentBorder: string;
    accentText: string;
    tabActive: string;
    rowHover: string;
    bar: string;
  }
> = {
  confirmed: {
    label: 'Confirmed',
    icon: BadgeCheck,
    accent: 'bg-emerald-800',
    accentSoft: 'bg-emerald-800/10',
    accentBorder: 'border-emerald-800/25',
    accentText: 'text-emerald-900',
    tabActive: 'bg-emerald-800 text-white shadow-sm',
    rowHover: 'hover:bg-emerald-950/[0.03]',
    bar: 'bg-emerald-800',
  },
  pending: {
    label: 'Pending',
    icon: Clock3,
    accent: 'bg-[hsl(var(--accent-brand))]',
    accentSoft: 'bg-[hsl(var(--accent-brand)/0.12)]',
    accentBorder: 'border-[hsl(var(--accent-brand)/0.3)]',
    accentText: 'text-amber-950',
    tabActive: 'bg-[hsl(var(--accent-brand))] text-white shadow-sm',
    rowHover: 'hover:bg-amber-950/[0.04]',
    bar: 'bg-[hsl(var(--accent-brand))]',
  },
  new_business: {
    label: 'New business',
    icon: Sparkles,
    accent: 'bg-[#182d6d]',
    accentSoft: 'bg-[#182d6d]/[0.08]',
    accentBorder: 'border-[#182d6d]/25',
    accentText: 'text-[#182d6d]',
    tabActive: 'bg-[#182d6d] text-white shadow-sm',
    rowHover: 'hover:bg-[#182d6d]/[0.03]',
    bar: 'bg-[#182d6d]',
  },
};

function money(cents: number): string {
  return formatCurrency(cents, { showCents: false });
}

/** Microsoft Excel mark for export actions. */
function ExcelLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#185C37"
        d="M14.5 2H6.2C5 2 4 3 4 4.2v15.6C4 21 5 22 6.2 22h11.6c1.2 0 2.2-1 2.2-2.2V7.5L14.5 2Z"
      />
      <path fill="#21A366" d="M14.5 2v4.3c0 1.2 1 2.2 2.2 2.2H21L14.5 2Z" />
      <path
        fill="#fff"
        d="M9.05 8.4h5.9c.5 0 .9.4.9.9v6.4c0 .5-.4.9-.9.9h-5.9c-.5 0-.9-.4-.9-.9V9.3c0-.5.4-.9.9-.9Zm.7 1.5v1.3h1.55V9.9H9.75Zm2.35 0v1.3h1.55V9.9H12.1Zm2.35 0v1.3h1.55V9.9H14.45Zm-4.7 2.1v1.3h1.55v-1.3H9.75Zm2.35 0v1.3h1.55v-1.3H12.1Zm2.35 0v1.3h1.55v-1.3H14.45Zm-4.7 2.1v1.3h1.55v-1.3H9.75Zm2.35 0v1.3h1.55v-1.3H12.1Zm2.35 0v1.3h1.55v-1.3H14.45Z"
      />
      <path
        fill="#107C41"
        d="M3.2 7.6h8.1c.55 0 1 .45 1 1v6.8c0 .55-.45 1-1 1H3.2c-.55 0-1-.45-1-1V8.6c0-.55.45-1 1-1Z"
      />
      <path
        fill="#fff"
        d="M5.05 15.4 7.25 12l-2.1-3.3h1.55l1.25 2.15c.12.22.2.38.26.5h.02c.08-.18.17-.35.27-.55L9.8 8.7h1.45L9.1 12l2.25 3.4H9.8l-1.4-2.35c-.08-.14-.15-.28-.22-.43h-.02c-.06.14-.13.29-.22.45l-1.4 2.33H5.05Z"
      />
    </svg>
  );
}

/** Google Sheets mark for export actions. */
function GoogleSheetsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#0F9D58"
        d="M14.5 2H6.2C5 2 4 3 4 4.2v15.6C4 21 5 22 6.2 22h11.6c1.2 0 2.2-1 2.2-2.2V7.5L14.5 2Z"
      />
      <path fill="#87C985" d="M14.5 2v4.3c0 1.2 1 2.2 2.2 2.2H21L14.5 2Z" />
      <path
        fill="#fff"
        d="M8 9.2h8c.33 0 .6.27.6.6v7c0 .33-.27.6-.6.6H8c-.33 0-.6-.27-.6-.6v-7c0-.33.27-.6.6-.6Zm.7 1.3v1.55h3.1V10.5H8.7Zm3.9 0v1.55h3.7V10.5h-3.7Zm-3.9 2.35v1.55h3.1v-1.55H8.7Zm3.9 0v1.55h3.7v-1.55h-3.7Zm-3.9 2.35V16.8h3.1v-1.6H8.7Zm3.9 0V16.8h3.7v-1.6h-3.7Z"
      />
    </svg>
  );
}

function statusVisual(status: string): {
  label: string;
  className: string;
  Icon: typeof CircleDot;
} {
  const s = status.toLowerCase();
  if (s.includes('executed') || s.includes('manual upload')) {
    return { label: status, className: 'bg-emerald-800/10 text-emerald-900', Icon: BadgeCheck };
  }
  if (s.includes('signed') && !s.includes('partial')) {
    return { label: status, className: 'bg-emerald-800/10 text-emerald-900', Icon: Check };
  }
  if (s.includes('sent') || s.includes('awaiting') || s.includes('partial')) {
    return { label: status, className: 'bg-sky-900/10 text-sky-950', Icon: Send };
  }
  if (s.includes('progress') || s.includes('review') || s.includes('draft') || s.includes('approved')) {
    return { label: status, className: 'bg-amber-900/10 text-amber-950', Icon: Clock3 };
  }
  if (s.includes('no contract')) {
    return { label: status, className: 'bg-stone-900/5 text-stone-600', Icon: CircleDot };
  }
  return { label: status, className: 'bg-stone-900/5 text-stone-700', Icon: CircleDot };
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

/** Parse "1) Foo 2) Bar" / comma / slash lists into clean brand names. */
function parseBrandList(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];

  if (/\d+\)\s*/.test(t)) {
    const parts = t
      .split(/\s*\d+\)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
    // Leading "1) OnlyBrand"
    const single = t.replace(/^\d+\)\s*/, '').trim();
    return single ? [single] : [];
  }

  if (/[/|,;\n]/.test(t)) {
    return t
      .split(/\s*[/|,;]\s*|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [t];
}

function BrandsCell({ text }: { text: string }) {
  const brands = parseBrandList(text);
  if (!brands.length) return <span className="text-muted-foreground">—</span>;

  const first = brands[0]!;
  const rest = brands.length - 1;
  if (rest <= 0) {
    return (
      <span className="block truncate text-xs text-muted-foreground" title={first}>
        {first}
      </span>
    );
  }

  return (
    <details
      className="group/brands relative"
      onClick={(e) => e.stopPropagation()}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden"
        title="Click to show all brands"
      >
        <span className="min-w-0 truncate text-xs text-muted-foreground">{first}</span>
        <span className="shrink-0 rounded bg-stone-900/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground group-open/brands:bg-[hsl(var(--accent-brand)/0.15)] group-open/brands:text-foreground">
          +{rest}
        </span>
      </summary>
      <ul className="mt-1.5 space-y-0.5 rounded-md border border-border/60 bg-bg-page px-2 py-1.5 text-xs text-muted-foreground shadow-sm">
        {brands.map((b, i) => (
          <li key={`${i}-${b}`} className="leading-snug text-foreground/85">
            <span className="mr-1 tabular-nums text-muted-foreground/60">{i + 1}.</span>
            {b}
          </li>
        ))}
      </ul>
    </details>
  );
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
      <Button asChild type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs">
        <Link href={`/contracts/${row.contract_id}`}>Open</Link>
      </Button>
    );
  }

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1.5">
      {row.contract_id ? (
        <Button asChild type="button" size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs">
          <Link href={`/contracts/${row.contract_id}`}>
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-800" />
            Open
          </Link>
        </Button>
      ) : (
        <Button asChild type="button" size="sm" className="h-7 gap-1 px-2.5 text-xs">
          <Link href={`/contracts/new?fromPipeline=${targetId}`}>
            <Send className="h-3.5 w-3.5" />
            Convert
          </Link>
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2.5 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Manage
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-border bg-bg-surface p-3 text-left shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">More actions</p>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-1.5">
              {row.contract_id ? (
                <Button asChild type="button" size="sm" variant="outline" className="h-8 justify-start">
                  <Link href={`/contracts/new?fromPipeline=${targetId}`}>Convert (new draft)</Link>
                </Button>
              ) : null}
              <Button asChild type="button" size="sm" variant="outline" className="h-8 justify-start">
                <Link href={`/contracts/import?fromPipeline=${targetId}`}>
                  <FileUp className="h-3.5 w-3.5" />
                  Import signed PDF
                </Link>
              </Button>
            </div>

            <div className="mt-3 space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Link in-progress contract
                </span>
              </label>
              <select
                className="w-full rounded-md border border-border/70 bg-bg-page px-2 py-1.5 text-xs"
                value={row.contract_id && linkableContracts.some((c) => c.id === row.contract_id) ? row.contract_id : ''}
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
                  <optgroup label="Likely matches (in progress)">
                    {suggested.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} · {c.status}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label={suggested.length ? 'Other in-progress' : 'In-progress contracts'}>
                  {(suggested.length ? others : linkableContracts).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} · {c.status}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Draft / sent / in review only — not signed or executed. Use this to avoid a duplicate account.
              </p>
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

function dollarsFromCents(cents: number): string {
  if (!cents) return '';
  return String(Math.round(cents) / 100);
}

function parseDollarsInput(raw: string): number {
  const n = Number(String(raw).replace(/[$,\s]/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Kate: adjust Confirmed booths (sheet/contract) and separately billed amounts. */
function ConfirmedAdjust({
  row,
  onSave,
}: {
  row: ParticipationReportRow;
  onSave: (payload: {
    contractId: string;
    boothCountOverride: number | null;
    additionalSpendDollars: number;
    totalSpendOverrideDollars: number | null;
    notes: string | null;
    clearOverrides?: boolean;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preferredAutoBooth = row.sheet_booth_count ?? row.contract_booth_count ?? 0;
  const [booths, setBooths] = useState(String(row.booth_count || ''));
  const [additional, setAdditional] = useState(dollarsFromCents(row.additional_spend_cents));
  const hasTotalOverride = row.total_spend_override_cents != null;
  const [totalOverride, setTotalOverride] = useState(
    hasTotalOverride ? dollarsFromCents(row.total_spend_override_cents ?? 0) : '',
  );
  const [notes, setNotes] = useState(row.notes);
  const [useTotalOverride, setUseTotalOverride] = useState(hasTotalOverride);

  if (!row.contract_id) return null;

  const contractSpend = row.contract_spend_cents ?? 0;
  const sheetBooths = row.sheet_booth_count;
  const contractBooths = row.contract_booth_count;

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1.5">
      <Button asChild type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
        <Link href={`/contracts/${row.contract_id}`}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-800" />
          Open
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2.5 text-xs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Adjust
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close adjust panel"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-30 w-80 rounded-lg border border-border bg-bg-surface p-3 text-left shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Participation adjust
              </p>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
              Contract stays as-is. Use this when booths live on the sheet (sponsorship contracts) or dollars are
              billed separately.
            </p>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Booths on report
                </label>
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  value={booths}
                  onChange={(e) => setBooths(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Sheet: {sheetBooths ?? '—'} · Contract: {contractBooths ?? '—'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Additional billed (outside contract)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-8 pl-6"
                    placeholder="e.g. 30000"
                    value={additional}
                    disabled={useTotalOverride}
                    onChange={(e) => setAdditional(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Contract {money(contractSpend)}
                  {additional ? ` + $${parseDollarsInput(additional).toLocaleString('en-US')}` : ''}
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-emerald-800"
                  checked={useTotalOverride}
                  onChange={(e) => {
                    setUseTotalOverride(e.target.checked);
                    if (e.target.checked && !totalOverride) {
                      setTotalOverride(dollarsFromCents(row.total_spend_cents));
                    }
                  }}
                />
                Set full report total instead
              </label>

              {useTotalOverride ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Report total
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 pl-6"
                      value={totalOverride}
                      onChange={(e) => setTotalOverride(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-md border border-border/70 bg-bg-page px-2 py-1.5 text-xs"
                  placeholder="e.g. $30k billed separately…"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    const boothNum = booths.trim() === '' ? null : Math.max(0, Math.round(Number(booths)));
                    if (booths.trim() !== '' && !Number.isFinite(boothNum)) {
                      setError('Booths must be a number');
                      return;
                    }
                    startTransition(async () => {
                      try {
                        const preferred = preferredAutoBooth;
                        const boothOverride =
                          boothNum == null || boothNum === preferred ? null : boothNum;
                        await onSave({
                          contractId: row.contract_id!,
                          boothCountOverride: boothOverride,
                          additionalSpendDollars: useTotalOverride ? 0 : parseDollarsInput(additional),
                          totalSpendOverrideDollars: useTotalOverride
                            ? parseDollarsInput(totalOverride)
                            : null,
                          notes: notes.trim() || null,
                        });
                        setOpen(false);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Save failed');
                      }
                    });
                  }}
                >
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await onSave({
                          contractId: row.contract_id!,
                          boothCountOverride: null,
                          additionalSpendDollars: 0,
                          totalSpendOverrideDollars: null,
                          notes: null,
                          clearOverrides: true,
                        });
                        setBooths(String(sheetBooths ?? contractBooths ?? ''));
                        setAdditional('');
                        setTotalOverride('');
                        setUseTotalOverride(false);
                        setNotes('');
                        setOpen(false);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Clear failed');
                      }
                    });
                  }}
                >
                  Reset
                </Button>
              </div>
              {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ParticipationReportClient({ initial }: { initial: ParticipationReport }) {
  const [report, setReport] = useState(initial);
  const [view, setView] = useState<ViewId>('pending');
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

  const viewAll = view === 'all';
  const totalCompanies = report.confirmed.length + report.pending.length + report.newBusiness.length;
  const sectionsToShow: TabId[] = viewAll ? ['confirmed', 'pending', 'new_business'] : [view];

  function rowsFor(id: TabId): ParticipationReportRow[] {
    if (id === 'confirmed') return report.confirmed;
    if (id === 'pending') return report.pending;
    return report.newBusiness;
  }

  function metaFor(id: TabId) {
    return tabs.find((t) => t.id === id)!;
  }

  function filteredRows(id: TabId): ParticipationReportRow[] {
    const base = rowsFor(id);
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
  }

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

  async function saveConfirmedAdjust(payload: {
    contractId: string;
    boothCountOverride: number | null;
    additionalSpendDollars: number;
    totalSpendOverrideDollars: number | null;
    notes: string | null;
    clearOverrides?: boolean;
  }) {
    const res = await fetch('/api/reports/participation/confirmed-overrides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: report.event.id,
        contractId: payload.contractId,
        boothCountOverride: payload.boothCountOverride,
        additionalSpendDollars: payload.additionalSpendDollars,
        totalSpendOverrideDollars: payload.totalSpendOverrideDollars,
        notes: payload.notes,
        clearOverrides: payload.clearOverrides,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(typeof j.error === 'string' ? j.error : 'Failed to save adjustment');
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
      setExportMsg(
        format === 'xlsx'
          ? 'Formatted Excel downloaded.'
          : format === 'csv'
            ? 'CSV downloaded (same layout as Excel; open Excel/Sheets for colors).'
            : 'Export done.',
      );
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
      setView('new_business');
      await refresh();
    } finally {
      setAddPending(false);
    }
  }

  return (
    <div className="relative -mx-6 w-[calc(100%+3rem)] space-y-5 px-6 lg:-mx-10 lg:w-[calc(100%+5rem)] lg:px-10">
      <div
        className="pointer-events-none absolute inset-x-0 -top-4 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(182,125,45,0.1),_transparent_60%)]"
        aria-hidden
      />

      {/* Header */}
      <div className="relative flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--accent-brand))]">
            <Sparkles className="h-3 w-3" />
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-[#185C37]/30 bg-[#185C37]/[0.04] px-3 hover:bg-[#185C37]/[0.08]"
            disabled={exporting}
            title="Formatted spreadsheet with section colors"
            onClick={() => runExport('xlsx')}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExcelLogo className="h-4 w-4 shrink-0" />}
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3"
            disabled={exporting}
            title="Same layout as Excel (plain text — no cell colors)"
            onClick={() => runExport('csv')}
          >
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-[#0F9D58]/35 bg-[#0F9D58]/[0.06] px-3 hover:bg-[#0F9D58]/[0.1]"
            disabled={exporting}
            title="Formatted Google Sheet shared with you"
            onClick={() => runExport('sheets')}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleSheetsLogo className="h-4 w-4 shrink-0" />}
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

      {/* Snapshot strip */}
      <div className="relative grid gap-2 sm:grid-cols-3">
        {tabs.map((t) => {
          const tone = TAB_THEME[t.id];
          const Icon = tone.icon;
          const active = viewAll || view === t.id;
          return (
            <button
              key={`snap-${t.id}`}
              type="button"
              onClick={() => setView(t.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
                active
                  ? cn(tone.accentSoft, tone.accentBorder, 'shadow-sm')
                  : 'border-border/60 bg-bg-surface hover:border-border',
              )}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white', tone.accent)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t.label}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-display text-xl font-medium tabular-nums text-foreground">{t.booths}</span>
                  <span className="text-xs text-muted-foreground">booths · {money(t.spend)}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-bg-surface p-1">
          <button
            type="button"
            onClick={() => setView('all')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              viewAll
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-stone-900/5 hover:text-foreground',
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            <span className="font-medium">View all</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                viewAll ? 'bg-white/20 text-white' : 'bg-stone-900/5 text-muted-foreground',
              )}
            >
              {totalCompanies}
            </span>
          </button>
          {tabs.map((t) => {
            const tone = TAB_THEME[t.id];
            const Icon = tone.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                  !viewAll && view === t.id
                    ? tone.tabActive
                    : 'text-muted-foreground hover:bg-stone-900/5 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{t.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    !viewAll && view === t.id ? 'bg-white/20 text-white' : 'bg-stone-900/5 text-muted-foreground',
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
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
          {viewAll || view === 'new_business' ? (
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setShowAdd((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Inquiry
            </Button>
          ) : null}
        </div>
      </div>

      {showAdd ? (
        <form onSubmit={addInquiry} className="grid gap-2 rounded-lg border border-[#182d6d]/20 bg-[#182d6d]/[0.04] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
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

      <div className={cn('space-y-4', viewAll && 'space-y-5')}>
        {sectionsToShow.map((sectionId) => {
          const theme = TAB_THEME[sectionId];
          const ThemeIcon = theme.icon;
          const sectionMeta = metaFor(sectionId);
          const rows = filteredRows(sectionId);
          const showManage = sectionId !== 'confirmed';
          const isConfirmed = sectionId === 'confirmed';

          return (
            <div
              key={sectionId}
              className={cn('overflow-hidden rounded-xl border bg-bg-surface', theme.accentBorder)}
            >
              <div
                className={cn(
                  'flex items-center justify-between gap-3 border-b px-3 py-2.5',
                  theme.accentSoft,
                  theme.accentBorder,
                )}
              >
                <p className={cn('flex items-center gap-2 text-xs', theme.accentText)}>
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', theme.accent)}>
                    <ThemeIcon className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="font-semibold">{sectionMeta.label}</span>
                    <span className="text-muted-foreground">
                      {' · '}
                      {rows.length}
                      {query ? ` match${rows.length === 1 ? '' : 'es'}` : ' companies'}
                      {' · '}
                      {sectionMeta.booths} booths · {money(sectionMeta.spend)}
                    </span>
                  </span>
                </p>
                {sectionId === 'pending' ? (
                  <p className="hidden text-[11px] text-muted-foreground sm:block">
                    Convert = DocuSign · Manage = Import / link · +N expands brands
                  </p>
                ) : null}
                {isConfirmed ? (
                  <p className="hidden text-[11px] text-muted-foreground sm:block">
                    Booths from Marvin sheet · Adjust = separate billing / booth override
                  </p>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-bg-surface-raised/80 text-left">
                      <th className="w-14 px-3 py-2">
                        <SortHeader
                          label="Rep"
                          sortKey="sales_rep_initials"
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={onSort}
                        />
                      </th>
                      <th className="min-w-[160px] px-3 py-2">
                        <SortHeader
                          label="Company"
                          sortKey="company_name"
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={onSort}
                        />
                      </th>
                      <th className="min-w-[180px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Brands
                      </th>
                      <th className="w-16 px-3 py-2 text-right">
                        <SortHeader
                          label="#"
                          sortKey="booth_count"
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={onSort}
                          align="right"
                        />
                      </th>
                      <th className="w-24 px-3 py-2 text-right">
                        <SortHeader
                          label="Total"
                          sortKey="total_spend_cents"
                          activeKey={sortKey}
                          dir={sortDir}
                          onSort={onSort}
                          align="right"
                        />
                      </th>
                      {showManage ? (
                        <th className="min-w-[140px] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Status / notes
                        </th>
                      ) : null}
                      {showManage ? (
                        <th className="min-w-[170px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Actions
                        </th>
                      ) : (
                        <th className="w-16 px-2 py-2" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showManage ? 7 : 6}
                          className="px-3 py-10 text-center text-sm text-muted-foreground"
                        >
                          {query ? 'No matches.' : 'Nothing in this section yet.'}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const status = statusVisual(row.pipeline_status);
                        const StatusIcon = status.Icon;
                        return (
                          <tr
                            key={row.id}
                            className={cn('border-b border-border/40 last:border-0', theme.rowHover)}
                          >
                            <td className="px-3 py-1.5 align-middle">
                              <span
                                className={cn(
                                  'inline-flex min-w-[2rem] justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide',
                                  theme.accentSoft,
                                  theme.accentText,
                                )}
                              >
                                {row.sales_rep_initials}
                              </span>
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
                                  <span
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-800/10 px-1 py-0.5 text-[10px] font-semibold text-emerald-900"
                                    title="Manual upload received"
                                  >
                                    <Check className="h-3 w-3" />
                                    PDF
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="max-w-[260px] px-3 py-1.5 align-top">
                              <BrandsCell text={row.brands_text} />
                            </td>
                            <td className="px-3 py-1.5 align-middle text-right tabular-nums">
                              <span
                                title={
                                  isConfirmed && row.booths_from_sheet_or_override
                                    ? `Sheet ${row.sheet_booth_count ?? '—'} · Contract ${row.contract_booth_count ?? '—'}`
                                    : undefined
                                }
                              >
                                {row.booth_count || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 align-middle text-right tabular-nums font-medium">
                              <span
                                className={cn(row.spend_is_adjusted && 'text-emerald-900')}
                                title={
                                  isConfirmed && row.contract_spend_cents != null
                                    ? row.spend_is_adjusted
                                      ? `Contract ${money(row.contract_spend_cents)}${
                                          row.additional_spend_cents
                                            ? ` + ${money(row.additional_spend_cents)} billed separately`
                                            : ' · manual total'
                                        }`
                                      : `Contract ${money(row.contract_spend_cents)}`
                                    : undefined
                                }
                              >
                                {money(row.total_spend_cents)}
                              </span>
                            </td>
                            {showManage ? (
                              <td className="max-w-[200px] px-3 py-1.5 align-middle">
                                <span
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                                    status.className,
                                  )}
                                  title={row.pipeline_status}
                                >
                                  <StatusIcon className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{row.pipeline_status}</span>
                                </span>
                                {(row.sheet_notes || row.notes) && (
                                  <p
                                    className="mt-0.5 truncate text-[11px] text-muted-foreground/80"
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
                              ) : (
                                <ConfirmedAdjust row={row} onSave={saveConfirmedAdjust} />
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {!query && rows.length > 0 ? (
                    <tfoot>
                      <tr className={cn('border-t', theme.accentSoft, theme.accentBorder)}>
                        <td className="px-3 py-1.5 align-middle font-medium text-foreground" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-1.5 align-middle text-right tabular-nums font-medium text-foreground">
                          {sectionMeta.booths}
                        </td>
                        <td className="px-3 py-1.5 align-middle text-right tabular-nums font-medium text-foreground">
                          {money(sectionMeta.spend)}
                        </td>
                        {showManage ? <td /> : null}
                        <td />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {viewAll || view === 'confirmed' ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-800" />
          Confirmed = executed contracts · booths prefer Marvin sheet · Adjust for separately billed amounts.
        </p>
      ) : null}
    </div>
  );
}
