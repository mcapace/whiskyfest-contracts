'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Columns3, Loader2, RefreshCw, Send, FilePlus2, ListFilter, CircleDashed, Clock, CheckCircle2, Mail, BadgeCheck, PenLine, Search, X, Ban, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';
import {
  rosterColumnModeLabel,
  formatRosterWineDisplay,
  rosterSheetFieldValue,
  visibleSheetColumns,
  visibleUiColumns,
  type RosterColumnMode,
} from '@/lib/exhibitor-roster-columns';
import {
  ROSTER_ALL_LISTS_ICON,
  rosterListBadgeClass,
  rosterListFilterClass,
  rosterListFilterCountClass,
  rosterListIcon,
  rosterListRowClass,
  rosterListShortLabel,
} from '@/lib/exhibitor-roster-list-style';
import {
  isActiveRosterParticipation,
  isRosterParticipationPending,
} from '@/lib/exhibitor-roster-participation';
import {
  NyweRosterWorkflowGuide,
  resolveNyweWorkflowStep,
} from '@/components/wine-spectator/nywe-roster-workflow-guide';
import { NyweBulkSendWizard, type NyweBulkSendRow } from '@/components/wine-spectator/nywe-bulk-send-wizard';
import { rosterAddressMissing, rosterAddressPreview } from '@/lib/exhibitor-roster-display';
import { ROSTER_CREATE_BATCH_MAX } from '@/lib/exhibitor-roster-constants';
import { nyweContractReadyForClientSend } from '@/lib/nywe-client-send-eligibility';
import { rosterWineryWebsiteUrl } from '@/lib/winery-website';
import { NyweBoothQrRowDownload } from '@/components/wine-spectator/nywe-booth-qr-row-download';
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
  billingStreet: string;
  billingCity: string;
  billingState: string;
  wineryAddress: string;
  wineryWebsite?: string;
  contractWebsiteUrl?: string | null;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryPhone: string;
  importerName: string;
  importerEmail: string;
  wineName: string;
  vintage: string;
  participation: string;
  contractId: string | null;
  contractStatus: ContractStatus | null;
  contractGrandTotalCents: number | null;
  contractBillingLine1: string | null;
  contractBillingCity: string | null;
  contractBillingState: string | null;
  contractBillingZip: string | null;
  contractSignerCcName: string | null;
  contractSignerCcEmail: string | null;
  portalCompanyName?: string | null;
  portalLegalName?: string | null;
  portalSignerName?: string | null;
  portalSignerEmail?: string | null;
  identityMismatch?: boolean;
  recalledToDraft: boolean;
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
  stale?: boolean;
  rateLimited?: boolean;
  fetchError?: string;
  warnings?: string[];
  event: { id: string; name: string; client_send_enabled: boolean };
  sheets: RosterSheet[];
  rows: RosterRow[];
};

const AUTO_REFRESH_MS = 15 * 60 * 1000;

function chunkItems<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

const COLUMN_MODES: RosterColumnMode[] = ['essential', 'extended', 'all'];

const FILTERS = [
  { key: 'all', label: 'All', icon: ListFilter },
  { key: 'not_started', label: 'Not in system', icon: CircleDashed },
  { key: 'in_progress', label: 'In progress', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'sent', label: 'Waiting on winery', icon: Mail },
  { key: 'countersign', label: 'Ready to countersign', icon: PenLine },
  { key: 'done', label: 'Signed / executed', icon: BadgeCheck },
  { key: 'voided', label: 'Voided / recalled', icon: Ban },
  { key: 'mismatch', label: 'Name mismatch', icon: AlertTriangle },
] as const;

function matchesFilter(row: RosterRow, filter: string): boolean {
  const status = row.contractStatus;
  const inPipeline = isActiveRosterParticipation(row.participation);
  switch (filter) {
    case 'not_started':
      return !row.contractId && (isRosterParticipationPending(row.participation) || inPipeline);
    case 'in_progress':
      return (
        inPipeline &&
        Boolean(status && ['draft', 'ready_for_review', 'pending_events_review'].includes(status))
      );
    case 'approved':
      return inPipeline && status === 'approved';
    case 'sent':
      return inPipeline && status === 'sent';
    case 'countersign':
      return inPipeline && status === 'partially_signed';
    case 'done':
      return inPipeline && Boolean(status && ['signed', 'executed'].includes(status));
    case 'voided':
      return Boolean(
        status && ['voided', 'cancelled', 'declined'].includes(status),
      ) || row.recalledToDraft;
    case 'mismatch':
      return Boolean(row.identityMismatch);
    default:
      return true;
  }
}

function matchesSearch(row: RosterRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.wineryName,
    row.portalCompanyName,
    row.portalLegalName,
    row.portalSignerName,
    row.portalSignerEmail,
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
  return haystack.includes(query);
}

const ROSTER_STICKY_LEFT_HEAD =
  'sticky left-0 z-30 w-12 min-w-[3rem] isolate overflow-hidden border-r border-border bg-card shadow-[6px_0_10px_-6px_rgba(0,0,0,0.18)]';
const ROSTER_STICKY_LEFT_BODY =
  'sticky left-0 z-20 w-12 min-w-[3rem] isolate overflow-hidden border-r border-border bg-card shadow-[6px_0_10px_-6px_rgba(0,0,0,0.18)] group-hover:bg-muted';
const ROSTER_STICKY_RIGHT_HEAD =
  'sticky right-0 z-30 min-w-[11rem] w-[11rem] isolate overflow-hidden border-l border-border bg-card pl-3 text-right shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.18)]';
const ROSTER_STICKY_RIGHT_BODY =
  'sticky right-0 z-20 min-w-[11rem] w-[11rem] isolate overflow-hidden border-l border-border bg-card pl-3 text-right shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.18)] group-hover:bg-muted';

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
      return (
        <div className="min-w-0 space-y-0.5">
          <CellText value={row.wineryName} className="font-medium" />
          {row.portalLegalName && row.portalLegalName.trim() !== row.wineryName.trim() ? (
            <span className="block max-w-[16rem] truncate text-xs text-muted-foreground" title={row.portalLegalName}>
              Legal: {row.portalLegalName}
            </span>
          ) : null}
          {row.identityMismatch && row.portalCompanyName ? (
            <span
              className="block max-w-[16rem] truncate text-xs font-medium text-amber-800"
              title={`Portal record: ${row.portalCompanyName}`}
            >
              Portal: {row.portalCompanyName}
            </span>
          ) : null}
        </div>
      );
    case 'list': {
      const ListIcon = rosterListIcon(row.listKey);
      return (
        <span className={rosterListBadgeClass(row.listKey)} title={row.listLabel}>
          <ListIcon className="h-2.5 w-2.5 shrink-0 opacity-80" aria-hidden />
          {rosterListShortLabel(row.listKey, row.listLabel)}
        </span>
      );
    }
    case 'wine':
      return <CellText value={formatRosterWineDisplay(row.wineName, row.vintage)} />;
    case 'signer':
      return (
        <div className="min-w-0">
          <CellText value={row.portalSignerName?.trim() || row.signerName} />
          {(row.portalSignerEmail || row.signerEmail) ? (
            <span
              className="block max-w-[16rem] truncate text-xs text-muted-foreground"
              title={row.portalSignerEmail || row.signerEmail}
            >
              {row.portalSignerEmail || row.signerEmail}
            </span>
          ) : null}
        </div>
      );
    case 'licenseStatus':
      return (
        <div className="min-w-0 max-w-full overflow-hidden">
          {row.recalledToDraft ? (
            <Badge className="w-fit max-w-full truncate border border-amber-600/35 bg-amber-50 text-amber-950 hover:bg-amber-50">
              Recalled
            </Badge>
          ) : row.contractStatus ? (
            <StatusBadge status={row.contractStatus} className="max-w-full truncate" />
          ) : (
            <span className="text-sm text-muted-foreground">Not started</span>
          )}
        </div>
      );
    case 'licenseFee':
      return row.contractGrandTotalCents != null ? (
        <span className="whitespace-nowrap tabular-nums text-sm font-medium">{formatCurrency(row.contractGrandTotalCents)}</span>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    case 'billingCompany':
      return <CellText value={row.billingCompany} />;
    case 'billingStreet':
      return <CellText value={row.billingStreet} />;
    case 'wineryAddress':
      return <CellText value={row.wineryAddress} />;
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

function RosterListFilterPill({
  active,
  icon: Icon,
  label,
  count,
  listKey,
  className,
  onClick,
  compact,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  listKey: string;
  className: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors',
        compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs',
        className,
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden />
      <span className="whitespace-nowrap leading-none">{label}</span>
      <span
        className={cn(
          'inline-flex min-w-[1.15rem] items-center justify-center rounded-full font-semibold leading-none tabular-nums',
          compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
          rosterListFilterCountClass(listKey, active),
        )}
      >
        {count}
      </span>
    </button>
  );
}

function licenseStatusFilterClass(filterKey: string, active: boolean, count: number): string {
  if (active) {
    if (filterKey === 'countersign') return 'border-fest-600 bg-fest-600 text-white shadow-sm hover:bg-fest-700';
    if (filterKey === 'sent') return 'border-amber-700 bg-amber-700 text-white shadow-sm hover:bg-amber-800';
    if (filterKey === 'done') return 'border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800';
    return 'border-foreground bg-foreground text-background shadow-sm hover:opacity-95';
  }
  if (filterKey === 'countersign' && count > 0) {
    return 'border-fest-300 bg-fest-50 text-fest-900 hover:bg-fest-100';
  }
  if (filterKey === 'sent' && count > 0) {
    return 'border-amber-300/80 bg-amber-50 text-amber-950 hover:bg-amber-100';
  }
  if (filterKey === 'voided' && count > 0) {
    return 'border-danger-base/25 bg-danger-bg text-danger-base hover:bg-danger-bg/90';
  }
  if (filterKey === 'mismatch' && count > 0) {
    return 'border-amber-300/80 bg-amber-50 text-amber-950 hover:bg-amber-100';
  }
  return 'border-border/70 bg-background text-foreground hover:bg-muted/50';
}

export function ExhibitorRosterPanel({ initial }: { initial: RosterPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [listFilter, setListFilter] = useState<string>('all');
  const [filter, setFilter] = useState<string>('all');
  const [columnMode, setColumnMode] = useState<RosterColumnMode>('essential');
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const creating = createProgress !== null;

  const showListColumn = listFilter === 'all';
  const uiColumns = useMemo(
    () => visibleUiColumns(columnMode, showListColumn),
    [columnMode, showListColumn],
  );
  const sheetColumns = useMemo(() => visibleSheetColumns(columnMode, data.rows), [columnMode, data.rows]);
  const tableColSpan = 2 + (columnMode === 'all' ? sheetColumns.length : uiColumns.length);

  const rowsForListCounts = useMemo(
    () => data.rows.filter((row) => matchesFilter(row, filter) && matchesSearch(row, search.trim().toLowerCase())),
    [data.rows, filter, search],
  );

  const rowsForStatusCounts = useMemo(
    () => data.rows.filter((row) => (listFilter === 'all' || row.listKey === listFilter) && matchesSearch(row, search.trim().toLowerCase())),
    [data.rows, listFilter, search],
  );

  const licenseFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of FILTERS) {
      counts.set(f.key, rowsForStatusCounts.filter((row) => matchesFilter(row, f.key)).length);
    }
    return counts;
  }, [rowsForStatusCounts]);

  const sheetTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rowsForListCounts) {
      counts.set(row.listKey, (counts.get(row.listKey) ?? 0) + 1);
    }
    const fromApi = data.sheets ?? [];
    const tabs: RosterSheet[] = fromApi.map((sheet) => ({
      ...sheet,
      count: counts.get(sheet.key) ?? 0,
    }));
    if (tabs.length === 0) {
      for (const [key, count] of counts) {
        const label = data.rows.find((r) => r.listKey === key)?.listLabel ?? key;
        tabs.push({ key, label, count });
      }
    }
    return tabs;
  }, [data.rows, data.sheets, rowsForListCounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (listFilter !== 'all' && row.listKey !== listFilter) return false;
      if (!matchesFilter(row, filter)) return false;
      return matchesSearch(row, q);
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
    const off = subscribeToAppContractEvents(() => {
      refresh({ preserveSelection: true });
    });
    return () => off();
  }, [refresh]);

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
    const keys =
      filter === 'not_started'
        ? filtered.filter((r) => !r.contractId).map((r) => r.rowKey)
        : filter === 'approved'
          ? filtered.filter((r) => r.contractStatus === 'approved' && r.contractId).map((r) => r.rowKey)
          : filtered.map((r) => r.rowKey);
    const allSelected = keys.length > 0 && keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const createItems = (items: { rowKey: string; listKey: string }[]) => {
    if (items.length === 0) {
      const selectedWithLicense = data.rows.filter((r) => selected.has(r.rowKey) && r.contractId).length;
      if (selectedWithLicense > 0) {
        setMessage(
          `None of your ${selectedWithLicense} selected row${selectedWithLicense === 1 ? '' : 's'} need new drafts — they already have contracts. Filter "Not in system" or use Step 1 in the workflow guide.`,
        );
      } else {
        setMessage('Select exhibitors without a contract, then click Create drafts.');
      }
      return;
    }

    startTransition(async () => {
      setMessage(null);
      setCreateProgress({ current: 0, total: items.length });

      let totalCreated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const errorReasons: string[] = [];
      const batches = chunkItems(items, ROSTER_CREATE_BATCH_MAX);
      let stoppedEarly = false;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]!;
        setCreateProgress({
          current: batchIndex * ROSTER_CREATE_BATCH_MAX,
          total: items.length,
        });

        const res = await fetch('/api/wine-spectator/roster/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          stoppedEarly = true;
          const detail =
            typeof json.error === 'string'
              ? json.error
              : 'Create failed — try again; contracts created so far are saved.';
          setMessage(
            `Stopped on batch ${batchIndex + 1} of ${batches.length}: ${detail} Created ${totalCreated} draft${totalCreated === 1 ? '' : 's'} before stopping.`,
          );
          break;
        }

        totalCreated += (json.created ?? []).length;
        totalSkipped += (json.skipped ?? []).length;
        totalErrors += (json.errors ?? []).length;
        for (const err of json.errors ?? []) {
          if (typeof err?.reason === 'string' && errorReasons.length < 3) {
            errorReasons.push(err.reason);
          }
        }

        setCreateProgress({
          current: Math.min((batchIndex + 1) * ROSTER_CREATE_BATCH_MAX, items.length),
          total: items.length,
        });
      }

      setCreateProgress(null);

      if (!stoppedEarly) {
        const errorHint =
          totalErrors > 0
            ? ` Sample issues: ${[...new Set(errorReasons)].join(' · ')}`
            : '';
        setMessage(
          `Created ${totalCreated} draft${totalCreated === 1 ? '' : 's'} · skipped ${totalSkipped} · errors ${totalErrors}${
            totalErrors > 0
              ? `${errorHint} — fix those rows in Google Sheets or try smaller batches.`
              : ''
          }${totalCreated === 0 && totalErrors === 0 && totalSkipped > 0 ? ' — selected rows already have contracts.' : ''}`,
        );
      }

      await refresh({ preserveSelection: true });
    });
  };

  const createSelected = () => {
    const items = data.rows
      .filter((r) => selected.has(r.rowKey) && !r.contractId)
      .map((r) => ({ rowKey: r.rowKey, listKey: r.listKey }));
    createItems(items);
  };

  const selectedCreatable = data.rows.filter((r) => selected.has(r.rowKey) && !r.contractId).length;

  const workflowCounts = useMemo(() => {
    const active = (row: RosterRow) =>
      isRosterParticipationPending(row.participation) || isActiveRosterParticipation(row.participation);
    const rows = data.rows.filter(active);
    return {
      notStarted: rows.filter((r) => !r.contractId).length,
      readyToSend: rows.filter((r) => r.contractId && nyweContractReadyForClientSend(r.contractStatus)).length,
      waitingOnWinery: rows.filter((r) => r.contractStatus === 'sent').length,
      readyToCountersign: rows.filter((r) => r.contractStatus === 'partially_signed').length,
    };
  }, [data.rows]);

  const activeWorkflowStep = resolveNyweWorkflowStep(workflowCounts);

  const sendableRows: NyweBulkSendRow[] = useMemo(() => {
    const active = (row: RosterRow) =>
      isRosterParticipationPending(row.participation) || isActiveRosterParticipation(row.participation);
    return data.rows
      .filter((r) => active(r) && r.contractId && nyweContractReadyForClientSend(r.contractStatus))
      .map((r) => ({
        rowKey: r.rowKey,
        wineryName: r.wineryName,
        signerName: r.signerName,
        signerEmail: r.signerEmail,
        contractId: r.contractId!,
        signerCcName: r.contractSignerCcName,
        signerCcEmail: r.contractSignerCcEmail,
        grandTotalCents: r.contractGrandTotalCents,
        addressPreview: rosterAddressPreview(r),
        addressMissing: rosterAddressMissing(r),
      }));
  }, [data.rows]);

  function selectAllCreatableVisible() {
    const keys = filtered.filter((r) => !r.contractId).map((r) => r.rowKey);
    setSelected(new Set(keys));
  }

  function startBulkSendWizard() {
    if (!data.event.client_send_enabled) {
      setMessage('Client send is disabled for this event.');
      return;
    }
    if (sendableRows.length === 0) {
      setMessage('No draft contracts to send. Create contracts from the roster first.');
      return;
    }
    setBulkSendOpen(true);
  }

  return (
    <div className="min-w-0 space-y-4">
      {!data.event.client_send_enabled ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-sm text-amber-950">
          Client send is disabled — create and approve contracts internally. Status still writes back to Google Sheets.
        </div>
      ) : null}

      {data.rateLimited && data.fetchError ? (
        <div className="rounded-md border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-950">
          Roster is up to date from{' '}
          <RelativeTime iso={data.syncedAt} />
          {'. '}
          {data.fetchError}
        </div>
      ) : null}

      {data.stale && data.fetchError && !data.rateLimited ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-sm text-amber-950">
          Could not refresh from Google Sheets ({data.fetchError}). Showing the last synced list from{' '}
          <RelativeTime iso={data.syncedAt} />. Use &quot;Refresh from sheets&quot; to try again.
        </div>
      ) : null}

      {data.warnings?.length ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-sm text-amber-950">
          {data.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <NyweRosterWorkflowGuide
        counts={workflowCounts}
        activeStep={activeWorkflowStep}
        filter={filter}
        selectedCreatable={selectedCreatable}
        readyToSend={sendableRows.length}
        clientSendEnabled={data.event.client_send_enabled}
        onSetFilter={setFilter}
        onSelectAllCreatable={selectAllCreatableVisible}
        onCreateDrafts={createSelected}
        onSendAllToClients={startBulkSendWizard}
      />

      {createProgress ? (
        <div className="rounded-xl border border-fest-200 bg-fest-50/80 px-4 py-3 text-sm text-fest-950">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            Creating drafts… {createProgress.current} of {createProgress.total}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fest-200">
            <div
              className="h-full bg-fest-700 transition-all duration-300"
              style={{
                width:
                  createProgress.total > 0
                    ? `${Math.round((createProgress.current / createProgress.total) * 100)}%`
                    : '0%',
              }}
            />
          </div>
        </div>
      ) : null}

      <NyweBulkSendWizard
        open={bulkSendOpen}
        onOpenChange={setBulkSendOpen}
        sendable={sendableRows}
        onComplete={(summary) => {
          startTransition(async () => {
            await refresh({ live: true, preserveSelection: true });
            if (summary.sent > 0) {
              setMessage(
                `Sent ${summary.sent} DocuSign email${summary.sent === 1 ? '' : 's'}${summary.failed > 0 ? ` · ${summary.failed} failed` : ''}. Countersign in DocuSign when wineries sign.`,
              );
            } else if (summary.failed > 0) {
              setMessage(`Bulk send failed for ${summary.failed} contract${summary.failed === 1 ? '' : 's'}.`);
            }
          });
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => refresh({ live: true })} disabled={pending}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Refresh from sheets
                </Button>
                <Button size="sm" className="h-8" onClick={createSelected} disabled={pending || creating || selectedCreatable === 0}>
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Create drafts ({selectedCreatable})
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={startBulkSendWizard}
                  disabled={pending || !data.event.client_send_enabled || sendableRows.length === 0}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send all to clients ({sendableRows.length})
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {data.fromCache ? 'Auto-synced' : 'Live from sheets'}{' '}
                <RelativeTime iso={data.syncedAt} />
                {' · '}
                <span className="font-medium text-foreground">{filtered.length}</span> shown
                {listFilter === 'all' ? (
                  <>
                    {' · '}
                    <span className="font-medium text-foreground">{data.rows.length}</span> total
                  </>
                ) : null}
                {(listFilter !== 'all' || filter !== 'all' || search.trim()) ? (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="font-medium text-accent-brand hover:underline"
                      onClick={() => {
                        setListFilter('all');
                        setFilter('all');
                        setSearch('');
                      }}
                    >
                      Clear filters
                    </button>
                  </>
                ) : null}
              </p>
            </div>

            <div className="relative w-full lg:w-72 lg:shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search winery, legal name, signer, brand…"
                className="h-9 border-border/70 bg-muted/20 pl-9 pr-9 text-sm shadow-none focus-visible:bg-background"
                aria-label="Search exhibitors"
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 border-t border-border/50 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">List</p>
            <p className="text-xs text-muted-foreground">Returning, new exhibitors, and champagne / sparkling</p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <RosterListFilterPill
                active={listFilter === 'all'}
                icon={ROSTER_ALL_LISTS_ICON}
                label="All lists"
                count={rowsForListCounts.length}
                listKey="all"
                className={rosterListFilterClass('all', listFilter === 'all')}
                onClick={() => setListFilter('all')}
              />
              {sheetTabs.map((sheet) => {
                const Icon = rosterListIcon(sheet.key);
                const active = listFilter === sheet.key;
                return (
                  <RosterListFilterPill
                    key={sheet.key}
                    active={active}
                    icon={Icon}
                    label={rosterListShortLabel(sheet.key, sheet.label)}
                    count={sheet.count}
                    listKey={sheet.key}
                    className={rosterListFilterClass(sheet.key, active)}
                    onClick={() => setListFilter(sheet.key)}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">License status</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowColumnOptions((open) => !open)}
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden />
                {showColumnOptions ? 'Hide columns' : 'More columns'}
                {columnMode !== 'essential' ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                    {rosterColumnModeLabel(columnMode)}
                  </span>
                ) : null}
              </Button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {FILTERS.map((f) => {
                const count = licenseFilterCounts.get(f.key) ?? 0;
                return (
                  <RosterListFilterPill
                    key={f.key}
                    active={filter === f.key}
                    icon={f.icon}
                    label={f.label}
                    count={count}
                    listKey="all"
                    className={licenseStatusFilterClass(f.key, filter === f.key, count)}
                    onClick={() => setFilter(f.key)}
                    compact
                  />
                );
              })}
            </div>
            {showColumnOptions ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                {COLUMN_MODES.map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={columnMode === mode ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => {
                      setColumnMode(mode);
                      if (mode === 'essential') setShowColumnOptions(false);
                    }}
                  >
                    {rosterColumnModeLabel(mode)}
                  </Button>
                ))}
                {columnMode === 'all' ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Scroll horizontally for every Google Sheet field from the synced rows.
                  </p>
                ) : columnMode === 'extended' ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Billing, contacts, and sheet sync columns in addition to essentials.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {message ? (
        <p className={cn('text-sm', creating ? 'text-muted-foreground' : 'rounded-md border border-border/60 bg-muted/30 p-3 font-medium')}>
          {message}
        </p>
      ) : null}

      <div className="relative isolate min-w-0 overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm">
        <Table
          wrapperClassName="overflow-visible min-w-full"
          className={cn(
            columnMode === 'all' ? 'min-w-max text-xs' : 'min-w-max w-full',
            '[&_td]:overflow-hidden [&_th]:overflow-hidden',
          )}
        >
          <TableHeader>
            <TableRow>
              <TableHead className={ROSTER_STICKY_LEFT_HEAD}>
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
                    <TableHead
                      key={col.id}
                      className="whitespace-nowrap"
                      style={{ minWidth: col.minWidth }}
                    >
                      {col.label}
                    </TableHead>
                  ))}
              <TableHead className={ROSTER_STICKY_RIGHT_HEAD}>
                Actions
              </TableHead>
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
                className={cn('group', rosterListRowClass(row.listKey, listFilter === 'all'))}
              >
                <TableCell className={ROSTER_STICKY_LEFT_BODY}>
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
                        <CellText value={rosterSheetFieldValue(row, label)} className="text-xs" />
                      </TableCell>
                    ))
                  : uiColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className="align-top"
                        style={{ minWidth: col.minWidth }}
                      >
                        {renderUiCell(row, col.id)}
                      </TableCell>
                    ))}
                <TableCell className={ROSTER_STICKY_RIGHT_BODY}>
                  {row.contractId ? (
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      {row.contractStatus === 'executed' ? (
                        <NyweBoothQrRowDownload
                          compact
                          contractId={row.contractId}
                          exhibitorName={row.portalCompanyName || row.wineryName}
                          websiteUrl={rosterWineryWebsiteUrl(row)}
                          missingHref={`/wine-spectator/contracts/${row.contractId}`}
                        />
                      ) : null}
                      <Link href={`/wine-spectator/contracts/${row.contractId}`} className="text-sm font-medium text-accent-brand hover:underline">
                        Open
                      </Link>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-medium text-accent-brand hover:underline"
                      disabled={pending || creating}
                      onClick={() => {
                        createItems([{ rowKey: row.rowKey, listKey: row.listKey }]);
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
