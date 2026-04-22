import Link from 'next/link';
import { Plus, FileText, DollarSign, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractWithTotals, Event, ContractStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

async function getDashboardData(actor: Awaited<ReturnType<typeof requireContractActorForPage>>) {
  const supabase = getSupabaseAdmin();

  let contractsQuery = supabase
    .from('contracts_with_totals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!actor.isAdmin && actor.salesRepId) {
    contractsQuery = contractsQuery.eq('sales_rep_id', actor.salesRepId);
  }

  let pendingQuery = supabase
    .from('contracts_with_totals')
    .select('*')
    .lt('booth_rate_cents', STANDARD_BOOTH_RATE_CENTS)
    .is('discount_approved_at', null)
    .order('created_at', { ascending: false })
    .limit(25);

  if (!actor.isAdmin && actor.salesRepId) {
    pendingQuery = pendingQuery.eq('sales_rep_id', actor.salesRepId);
  }

  const [{ data: contracts }, { data: pendingDiscounts }, { data: events }] = await Promise.all([
    contractsQuery,
    pendingQuery,
    supabase.from('events').select('*').eq('is_active', true),
  ]);

  return {
    contracts: (contracts ?? []) as ContractWithTotals[],
    pendingDiscounts: (pendingDiscounts ?? []) as ContractWithTotals[],
    events: (events ?? []) as Event[],
    actor,
  };
}

export default async function DashboardPage() {
  const actor = await requireContractActorForPage();
  const { contracts, pendingDiscounts, events } = await getDashboardData(actor);

  // Stats
  const totalExecutedCents  = contracts.filter(c => c.status === 'executed').reduce((a, c) => a + c.grand_total_cents, 0);
  const totalInFlightCents  = contracts.filter(c => ['sent', 'signed', 'approved', 'ready_for_review'].includes(c.status)).reduce((a, c) => a + c.grand_total_cents, 0);
  const totalPipelineCents  = totalExecutedCents + totalInFlightCents;
  const draftCount          = contracts.filter(c => c.status === 'draft').length;
  const executedCount       = contracts.filter(c => c.status === 'executed').length;

  const eventMap = new Map(events.map(e => [e.id, e]));
  const contractsCount = contracts.length;
  const progressPct = totalPipelineCents > 0 ? Math.round((totalExecutedCents / totalPipelineCents) * 100) : 0;

  const statusCounts: Array<{ label: string; count: number; tone: string; href: string }> = [
    { label: 'Draft', count: contracts.filter(c => c.status === 'draft').length, tone: 'bg-whisky-100 text-whisky-900 border-whisky-200', href: '/contracts?status=draft' },
    { label: 'In Review', count: contracts.filter(c => c.status === 'ready_for_review').length, tone: 'bg-amber-100 text-amber-900 border-amber-200', href: '/contracts?status=ready_for_review' },
    { label: 'Approved', count: contracts.filter(c => c.status === 'approved').length, tone: 'bg-fest-100 text-fest-900 border-fest-200', href: '/contracts?status=approved' },
    { label: 'Executed', count: contracts.filter(c => c.status === 'executed').length, tone: 'bg-emerald-100 text-emerald-900 border-emerald-200', href: '/contracts?status=executed' },
  ];

  const pendingHeading = actor.isAdmin ? 'Pending Your Approval' : 'My Pending Approvals';

  return (
    <div className="space-y-8">
      {pendingDiscounts.length > 0 && (
        <Card className="overflow-hidden border-amber-400/40 bg-amber-50/40">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/25 px-6 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              <h2 className="font-serif text-lg font-semibold text-amber-950">{pendingHeading}</h2>
            </div>
            <p className="text-xs text-amber-900/80">
              Discounted booth rate — below {formatCurrency(STANDARD_BOOTH_RATE_CENTS)} — awaiting admin approval
            </p>
          </div>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            {pendingDiscounts.map((c) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="rounded-lg border border-amber-300/60 bg-background/80 p-4 transition-colors hover:border-amber-500 hover:bg-amber-50/80"
              >
                <p className="font-medium text-foreground">{c.exhibitor_company_name}</p>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <p>
                    Booth rate <span className="font-mono tabular-nums">{formatCurrency(c.booth_rate_cents)}</span>
                    {' · '}
                    Total <span className="font-mono tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                  </p>
                  <p>
                    Created by {c.created_by ?? '—'} · {formatRelative(c.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card className="overflow-hidden border-fest-600/15">
        <div className="bg-gradient-to-r from-fest-600/10 via-brass-100/35 to-background px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brass-700">
            M. Shanken Communications
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight">
            Contract Pipeline
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {contractsCount} total contracts · {events.length} active event{events.length !== 1 && 's'}
          </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/contracts">View all</Link>
              </Button>
              <Button asChild>
                <Link href="/contracts/new">
                  <Plus className="h-4 w-4" /> New Contract
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Pipeline completion</span>
              <span>{progressPct}% executed value</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-fest-100/70">
              <div className="h-full rounded-full bg-gradient-to-r from-fest-600 to-fest-400" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CheckCircle2} label="Executed" value={formatCurrency(totalExecutedCents)} sub={`${executedCount} contracts`} accent="emerald" />
        <StatCard icon={Clock}        label="In Flight" value={formatCurrency(totalInFlightCents)} sub="Sent + Approved + In Review" accent="amber" />
        <StatCard icon={FileText}     label="Drafts"    value={String(draftCount)}                  sub="Awaiting review" accent="whisky" />
        <StatCard icon={DollarSign}   label="Total Pipeline" value={formatCurrency(totalPipelineCents)} sub="All active contract value" accent="fest" />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusCounts.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm ${s.tone}`}
          >
            <span>{s.label}</span>
            <span className="font-mono tabular-nums">{s.count}</span>
          </Link>
        ))}
      </div>

      {/* Contracts table */}
      <Card className="overflow-hidden border-fest-600/15">
        <div className="flex items-center justify-between border-b border-fest-600/10 px-6 py-4">
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
            <Table className="[&_tbody_tr:hover]:bg-fest-50/50">
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
                      <Link href={`/contracts/${c.id}`} className="block hover:text-fest-800">
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
                        className="text-fest-700 opacity-0 transition-opacity group-hover:opacity-100"
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
  accent: 'whisky' | 'fest' | 'amber' | 'emerald';
}) {
  const accentClass = {
    whisky:  'text-whisky-800 bg-whisky-100/60 ring-whisky-300/30',
    fest:    'text-fest-800 bg-fest-100/90 ring-fest-300/30',
    amber:   'text-amber-700 bg-amber-100/60 ring-amber-300/30',
    emerald: 'text-emerald-700 bg-emerald-100/60 ring-emerald-300/30',
  }[accent];

  return (
    <Card className="border-fest-600/10 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ring-1 ${accentClass}`}>
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
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fest-100 text-fest-800">
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
