import Link from 'next/link';
import { Plus, FileText, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractWithTotals, Event, ContractStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const supabase = getSupabaseAdmin();

  const [{ data: contracts }, { data: events }] = await Promise.all([
    supabase
      .from('contracts_with_totals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('events')
      .select('*')
      .eq('is_active', true),
  ]);

  return {
    contracts: (contracts ?? []) as ContractWithTotals[],
    events: (events ?? []) as Event[],
  };
}

export default async function DashboardPage() {
  const { contracts, events } = await getDashboardData();

  // Stats
  const totalExecutedCents  = contracts.filter(c => c.status === 'executed').reduce((a, c) => a + c.grand_total_cents, 0);
  const totalInFlightCents  = contracts.filter(c => ['sent', 'signed', 'approved', 'ready_for_review'].includes(c.status)).reduce((a, c) => a + c.grand_total_cents, 0);
  const draftCount          = contracts.filter(c => c.status === 'draft').length;
  const executedCount       = contracts.filter(c => c.status === 'executed').length;

  const eventMap = new Map(events.map(e => [e.id, e]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brass-700">
            M. Shanken Communications
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight">
            Contract Pipeline
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {contracts.length} total contracts · {events.length} active event{events.length !== 1 && 's'}
          </p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="h-4 w-4" /> New Contract
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Executed" value={formatCurrency(totalExecutedCents)} sub={`${executedCount} contracts`} accent="emerald" />
        <StatCard icon={Clock}        label="In Flight" value={formatCurrency(totalInFlightCents)} sub="Sent + Approved + In Review" accent="amber" />
        <StatCard icon={FileText}     label="Drafts"    value={String(draftCount)}                  sub="Awaiting review" accent="whisky" />
        <StatCard icon={DollarSign}   label="Total Pipeline" value={formatCurrency(totalExecutedCents + totalInFlightCents)} sub="All active contract value" accent="whisky" />
      </div>

      {/* Contracts table */}
      <Card>
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold">Recent Contracts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Most recent 50 contracts across all statuses</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contracts">View all →</Link>
          </Button>
        </div>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <EmptyState />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exhibitor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(c => (
                  <TableRow key={c.id} className="group">
                    <TableCell>
                      <Link href={`/contracts/${c.id}`} className="block hover:text-whisky-800">
                        <div className="font-medium">{c.exhibitor_company_name}</div>
                        {c.brands_poured && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{c.brands_poured}</div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {eventMap.get(c.event_id)?.name ?? '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(c.grand_total_cents)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatRelative(c.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="text-whisky-800 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, sub, accent
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string;
  accent: 'whisky' | 'amber' | 'emerald';
}) {
  const accentClass = {
    whisky:  'text-whisky-800 bg-whisky-100/60',
    amber:   'text-amber-700 bg-amber-100/60',
    emerald: 'text-emerald-700 bg-emerald-100/60',
  }[accent];

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-whisky-100 text-whisky-800">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="font-serif text-lg font-semibold">No contracts yet</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Once you create your first contract, it'll show up here with its full status history.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/contracts/new">
          <Plus className="h-4 w-4" /> Create your first contract
        </Link>
      </Button>
    </div>
  );
}
