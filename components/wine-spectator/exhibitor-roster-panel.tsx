'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Columns3, Loader2, RefreshCw, Send, FilePlus2, ListFilter, CircleDashed, Clock, CheckCircle2, Mail, BadgeCheck, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
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
  fetchError?: string;
  warnings?: string[];
  event: { id: string; name: string; client_send_enabled: boolean };
  sheets: RosterSheet[];
  rows: RosterRow[];
};

const AUTO_REFRESH_MS = 2 * 60 * 1000;

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
    default:
      return true;
  }
}

function matchesSearch(row: RosterRow, query: string): boolean {
  if (!query) return true;
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
  return haystack.includes(query);
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
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  listKey: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="whitespace-nowrap leading-none">{label}</span>
      <span
        className={cn(
          'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums',
          rosterListFilterCountClass(listKey, active),
        )}
      >
        {count}
      </span>
    </button>
  );
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
      refresh({ preserveSelection: true, live: true });
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh({ preserveSelection: true, live: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      refresh({ preserveSelection: true, live: true });
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
          `None of your ${selectedWithLicense} selected row${selectedWithLicense === 1 ? '' : 's'} need new drafts — they already have licenses. Filter "Not in system" or use Step 1 in the workflow guide.`,
        );
      } else {
        setMessage('Select exhibitors without a license, then click Create drafts.');
      }
      return;
    }

    startTransition(async () => {
      setMessage(null);
      setCreateProgress({ current: 0, total: items.length });

      let totalCreated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
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
              : 'Create failed — try again; licenses created so far are saved.';
          setMessage(
            `Stopped on batch ${batchIndex + 1} of ${batches.length}: ${detail} Created ${totalCreated} draft${totalCreated === 1 ? '' : 's'} before stopping.`,
          );
          break;
        }

        totalCreated += (json.created ?? []).length;
        totalSkipped += (json.skipped ?? []).length;
        totalErrors += (json.errors ?? []).length;

        setCreateProgress({
          current: Math.min((batchIndex + 1) * ROSTER_CREATE_BATCH_MAX, items.length),
          total: items.length,
        });
      }

      setCreateProgress(null);

      if (!stoppedEarly) {
        setMessage(
          `Created ${totalCreated} draft${totalCreated === 1 ? '' : 's'} · skipped ${totalSkipped} · errors ${totalErrors}${
            totalErrors > 0 ? ' (often missing signer email or billing address in the sheet)' : ''
          }`,
        );
      }

      await refresh({ live: true, preserveSelection: true });
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
      setMessage('No draft licenses to send. Create licenses from the roster first.');
      return;
    }
    setBulkSendOpen(true);
  }

  return (
    <div className="space-y-4">
      {!data.event.client_send_enabled ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-sm text-amber-950">
          Client send is disabled — create and approve licenses internally. Status still writes back to Google Sheets.
        </div>
      ) : null}

      {data.stale && data.fetchError ? (
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
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
            Creating drafts… {createProgress.current} of {createProgress.total}
          </p>
          <p className="mt-1 text-rose-900/90">Keep this tab open — large lists run in batches of {ROSTER_CREATE_BATCH_MAX}.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-200">
            <div
              className="h-full bg-rose-700 transition-all duration-300"
              style={{
                width:
                  createProgress.total > 0
                    ? `${Math.round((createProgress.current / createProgress.total) * 100)}%`
                    : '0%',
              }}
            />
          </div>
        </div>
      ) : selectedCreatable > 0 ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="font-medium">
            {selectedCreatable} winery{selectedCreatable === 1 ? '' : 'ies'} selected — next step: create drafts
          </p>
          <p className="mt-1 text-rose-900/90">
            Checking boxes only selects rows. Click the button below (or <strong>Create drafts</strong> in Step 1) to
            start. Large lists process {ROSTER_CREATE_BATCH_MAX} at a time and may take several minutes.
          </p>
          <Button type="button" className="mt-3" size="sm" onClick={createSelected} disabled={pending || creating}>
            <FilePlus2 className="h-4 w-4" />
            Create drafts ({selectedCreatable})
          </Button>
        </div>
      ) : null}

      {sendableRows.length > 0 && !createProgress && selectedCreatable === 0 ? (
        <div className="rounded-lg border border-sky-300/90 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-medium">
            {sendableRows.length} draft license{sendableRows.length === 1 ? '' : 's'} ready for bulk send
          </p>
          <p className="mt-1 text-sky-900/90">
            Roster licenses are treated as pre-approved. Click below to generate PDFs and email DocuSign to every winery
            — no need to open each license.
          </p>
          <Button
            type="button"
            className="mt-3"
            size="sm"
            onClick={startBulkSendWizard}
            disabled={pending || !data.event.client_send_enabled}
          >
            <Send className="h-4 w-4" />
            Send all to clients ({sendableRows.length})
          </Button>
        </div>
      ) : null}

      {selected.size > 0 && selectedCreatable === 0 && filter === 'all' ? (
        <div className="rounded-lg border border-amber-300/90 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Your selection includes wineries that already have licenses.</p>
          <p className="mt-1 text-amber-900/90">
            To create new drafts, filter <strong>Not in system</strong> or use Step 1 in the workflow guide — then{' '}
            <strong>Select all visible</strong> will only pick rows without a license.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setFilter('not_started')}>
              Show not in system
            </Button>
            {sendableRows.length > 0 ? (
              <Button type="button" size="sm" onClick={startBulkSendWizard}>
                Send all to clients ({sendableRows.length})
              </Button>
            ) : null}
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
              setMessage(`Bulk send failed for ${summary.failed} license${summary.failed === 1 ? '' : 's'}.`);
            }
          });
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => refresh({ live: true })} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh from sheets
        </Button>
        <Button size="sm" onClick={createSelected} disabled={pending || creating || selectedCreatable === 0}>
          <FilePlus2 className="h-4 w-4" />
          Create drafts ({selectedCreatable})
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={startBulkSendWizard}
          disabled={pending || !data.event.client_send_enabled || sendableRows.length === 0}
        >
          <Send className="h-4 w-4" />
          Send all to clients ({sendableRows.length})
        </Button>
        <span className="text-xs text-muted-foreground">
          {data.fromCache ? 'Auto-synced' : 'Live from sheets'} <RelativeTime iso={data.syncedAt} /> · {filtered.length} shown
          {listFilter === 'all' ? ` · ${data.rows.length} total` : ''}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exhibitor list</p>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">License status</p>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <RosterListFilterPill
              key={f.key}
              active={filter === f.key}
              icon={f.icon}
              label={f.label}
              count={licenseFilterCounts.get(f.key) ?? 0}
              listKey="all"
              className={rosterListFilterClass('all', filter === f.key)}
              onClick={() => setFilter(f.key)}
            />
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search winery, signer, billing…"
            className="h-8 max-w-xs text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => setShowColumnOptions((open) => !open)}
          >
            <Columns3 className="h-3.5 w-3.5" aria-hidden />
            {showColumnOptions ? 'Hide columns' : 'More columns'}
          </Button>
          {columnMode !== 'essential' ? (
            <span className="text-xs text-muted-foreground">
              Viewing: {rosterColumnModeLabel(columnMode)}
            </span>
          ) : null}
        </div>
        {showColumnOptions ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
            {COLUMN_MODES.map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={columnMode === mode ? 'default' : 'outline'}
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

      {message ? (
        <p className={cn('text-sm', creating ? 'text-muted-foreground' : 'rounded-md border border-border/60 bg-muted/30 p-3 font-medium')}>
          {message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table className={cn(columnMode === 'all' ? 'min-w-max text-xs' : 'w-full table-fixed')}>
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
                    <TableHead key={col.id} className="whitespace-nowrap" style={{ width: col.minWidth }}>
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
                        <CellText value={rosterSheetFieldValue(row, label)} className="text-xs" />
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
