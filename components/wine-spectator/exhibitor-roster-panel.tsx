'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, Send, FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatRelative } from '@/lib/utils';
import type { ContractStatus } from '@/types/db';

type RosterRow = {
  rowKey: string;
  listKey: string;
  listLabel: string;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  wineName: string;
  vintage: string;
  contractId: string | null;
  contractStatus: ContractStatus | null;
  sheetStatus: string | null;
  sheetLastUpdated: string | null;
};

type RosterPayload = {
  syncedAt: string;
  event: { id: string; name: string; client_send_enabled: boolean };
  rows: RosterRow[];
};

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

export function ExhibitorRosterPanel({ initial }: { initial: RosterPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (!matchesFilter(row, filter)) return false;
      if (!q) return true;
      return (
        row.wineryName.toLowerCase().includes(q) ||
        row.signerName.toLowerCase().includes(q) ||
        row.signerEmail.toLowerCase().includes(q)
      );
    });
  }, [data.rows, filter, search]);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch('/api/wine-spectator/roster', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? 'Refresh failed');
        return;
      }
      setData(json as RosterPayload);
      setSelected(new Set());
      router.refresh();
    });
  }, [router]);

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
      await refresh();
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
      await refresh();
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
        <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
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
          Synced {formatRelative(data.syncedAt)} · {data.rows.length} confirmed exhibitors
        </span>
      </div>

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
          placeholder="Search winery, signer, email…"
          className="max-w-xs"
        />
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible"
                  checked={filtered.length > 0 && filtered.every((r) => selected.has(r.rowKey))}
                  onChange={toggleAllVisible}
                />
              </TableHead>
              <TableHead>Winery</TableHead>
              <TableHead>List</TableHead>
              <TableHead>Signer</TableHead>
              <TableHead>License status</TableHead>
              <TableHead>Sheet status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.rowKey}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.wineryName}`}
                    checked={selected.has(row.rowKey)}
                    onChange={() => toggleRow(row.rowKey)}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium">{row.wineryName}</div>
                  {(row.wineName || row.vintage) && (
                    <div className="text-xs text-muted-foreground">
                      {[row.wineName, row.vintage].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.listLabel}</TableCell>
                <TableCell>
                  <div className="text-sm">{row.signerName || '—'}</div>
                  <div className="text-xs text-muted-foreground">{row.signerEmail || '—'}</div>
                </TableCell>
                <TableCell>
                  {row.contractStatus ? <StatusBadge status={row.contractStatus} /> : <span className="text-sm text-muted-foreground">Not started</span>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.sheetStatus || '—'}</TableCell>
                <TableCell className="text-right">
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
