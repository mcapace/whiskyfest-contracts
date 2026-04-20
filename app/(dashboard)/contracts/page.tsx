import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
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
  'approved',
  'sent',
  'signed',
  'executed',
  'cancelled',
  'error',
]);

async function loadContracts(searchParams: { status?: string; q?: string }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false }).limit(200);

  const status = searchParams.status;
  if (status && status !== 'all' && VALID.has(status)) {
    query = query.eq('status', status as ContractStatus);
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
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events } = await loadContracts({ status, q });
  const eventMap = new Map(events.map(e => [e.id, e]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brass-700">
            Pipeline
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight">
            All Contracts
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

      <Card>
        <div className="border-b border-border/50 px-6 py-4">
          <ContractsFilters />
        </div>
        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No contracts match these filters.
            </div>
          ) : (
            <Table>
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
