import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { getVisibleContractsFilter } from '@/lib/permissions';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/contracts/status-badge';
import { ContractsFilters } from '@/components/contracts/contracts-filters';
import type { ContractWithTotals, ContractStatus, Event } from '@/types/db';

export const dynamic = 'force-dynamic';

const VALID: Set<string> = new Set([
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'executed',
  'cancelled',
  'error',
]);

async function loadContracts(
  actor: Awaited<ReturnType<typeof requireContractActorForPage>>,
  searchParams: { status?: string; q?: string },
) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false }).limit(200);

  const { data: appUser } = await supabase
    .from('app_users')
    .select('is_accounting, can_view_all_sales')
    .eq('email', actor.email)
    .maybeSingle();
  const visibility = getVisibleContractsFilter({
    role: actor.role,
    is_events_team: actor.isEventsTeam,
    is_accounting: Boolean((appUser as { is_accounting?: boolean } | null)?.is_accounting),
    can_view_all_sales: Boolean((appUser as { can_view_all_sales?: boolean } | null)?.can_view_all_sales),
    accessibleSalesRepIds: actor.accessibleSalesRepIds,
  });
  if (visibility.filter === 'own' && visibility.salesRepIds.length > 0) {
    query = query.in('sales_rep_id', visibility.salesRepIds);
  } else if (visibility.filter === 'own') {
    query = query.limit(0);
  }

  const status = searchParams.status;
  if (status && status !== 'all') {
    if (status === 'draft') {
      query = query.or('status.eq.draft,status.eq.ready_for_review');
    } else if (VALID.has(status)) {
      query = query.eq('status', status as ContractStatus);
    }
  }

  const q = searchParams.q?.trim();
  if (q) {
    query = query.ilike('exhibitor_company_name', `%${q}%`);
  }

  const [{ data: contracts }, { data: events }] = await Promise.all([
    query,
    supabase.from('events').select('*'),
  ]);

  return {
    contracts: (contracts ?? []) as ContractWithTotals[],
    events: (events ?? []) as Event[],
  };
}

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireContractActorForPage();
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events } = await loadContracts(actor, { status, q });
  const eventMap = new Map(events.map(e => [e.id, e]));
  const executedCount = contracts.filter(c => c.status === 'executed').length;
  const inFlightCount = contracts.filter(c =>
    ['ready_for_review', 'approved', 'sent', 'partially_signed', 'signed', 'pending_events_review'].includes(c.status),
  ).length;
  const draftCount = contracts.filter(c => c.status === 'draft' || c.status === 'ready_for_review').length;
  const pipelineValue = contracts.reduce((acc, c) => acc + c.grand_total_cents, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brass-700">
            Pipeline
          </p>
          <h1 className="font-display text-5xl font-medium leading-tight tracking-tight">
            Contracts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {contracts.length} result{contracts.length !== 1 ? 's' : ''}
            {status && status !== 'all' ? ` · filtered by status` : ''}
            {q ? ` · search “${q}”` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/contracts/export">Export CSV</a>
          </Button>
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="h-4 w-4" /> New Contract
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniMetric label="Executed" value={String(executedCount)} tone="text-emerald-800 bg-emerald-100/70 border-emerald-200/80" />
        <MiniMetric label="In Flight" value={String(inFlightCount)} tone="text-amber-800 bg-amber-100/70 border-amber-200/80" />
        <MiniMetric label="Draft" value={String(draftCount)} tone="text-whisky-900 bg-whisky-100/70 border-whisky-200/80" />
        <MiniMetric label="Total Value" value={formatCurrency(pipelineValue)} tone="text-fest-900 bg-fest-100/80 border-fest-200/80" />
      </div>

      <Card className="overflow-hidden border-fest-600/15">
        <div className="border-b border-fest-600/10 bg-gradient-to-r from-fest-50/70 to-transparent px-6 py-4">
          <ContractsFilters />
        </div>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No contracts match these filters.
            </div>
          ) : (
            <Table className="[&_tbody_tr:hover]:bg-fest-50/50">
              <TableHeader>
                <TableRow>
                  <TableHead>Exhibitor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
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
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(c.grand_total_cents)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatRelative(c.updated_at)}
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

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${tone}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold leading-none tabular-nums">{value}</p>
    </div>
  );
}
