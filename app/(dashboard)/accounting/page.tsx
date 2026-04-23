import Link from 'next/link';
import { requireAccountingPageAccess } from '@/lib/auth-accounting';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatInvoiceStatus, invoiceStatusBadgeClass } from '@/lib/invoice-status';
import { ARStatCard } from '@/components/accounting/ar-stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

function parseInvoiceFilter(raw: string | undefined): InvoiceStatus | 'all' {
  if (raw === 'pending' || raw === 'invoice_sent' || raw === 'paid') return raw;
  return 'all';
}

export default async function AccountingDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAccountingPageAccess();

  const invoice = parseInvoiceFilter(typeof searchParams?.invoice === 'string' ? searchParams.invoice : undefined);
  const q = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';
  const repQ = typeof searchParams?.rep === 'string' ? searchParams.rep.trim() : '';

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('status', 'executed')
    .order('executed_at', { ascending: false })
    .limit(500);

  if (invoice !== 'all') {
    query = query.eq('invoice_status', invoice);
  }
  if (q) {
    query = query.ilike('exhibitor_company_name', `%${q}%`);
  }
  if (repQ) {
    const safe = repQ.replace(/%/g, '').replace(/_/g, '\\_');
    query = query.or(`sales_rep_name.ilike.%${safe}%,sales_rep_email.ilike.%${safe}%`);
  }

  const [{ data: rows }, { data: eventsData }] = await Promise.all([
    query,
    supabase.from('events').select('*'),
  ]);

  const contracts = (rows ?? []) as ContractWithTotals[];
  const eventMap = new Map((eventsData ?? []).map((e: Event) => [e.id, e]));

  const executedAll = contracts.filter(() => true); // already filtered server-side — for stats reload without extra query, derive from unfiltered:
  const { data: allExecuted } = await supabase
    .from('contracts_with_totals')
    .select('grand_total_cents, invoice_status')
    .eq('status', 'executed')
    .limit(2000);

  const statsRows = (allExecuted ?? []) as Pick<ContractWithTotals, 'grand_total_cents' | 'invoice_status'>[];

  const sumFor = (inv: InvoiceStatus | 'all') =>
    statsRows
      .filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv)
      .reduce((a, r) => a + (r.grand_total_cents ?? 0), 0);

  const countFor = (inv: InvoiceStatus | 'all') =>
    statsRows.filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv).length;

  const pendingTotal = sumFor('pending');
  const sentTotal = sumFor('invoice_sent');
  const paidTotal = sumFor('paid');
  const arTotal = statsRows.reduce((a, r) => a + (r.grand_total_cents ?? 0), 0);

  const base = '/accounting';
  const sp = new URLSearchParams();
  if (q) sp.set('q', q);
  if (repQ) sp.set('rep', repQ);
  const extra = sp.toString();

  function href(inv: InvoiceStatus | 'all') {
    const p = new URLSearchParams(extra);
    if (inv === 'all') p.delete('invoice');
    else p.set('invoice', inv);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-border/50 pb-8">
        <p className="wf-label-caps text-brass-700 dark:text-brass-400">Accounting</p>
        <h1 className="wf-display-serif mt-2 text-3xl text-foreground md:text-4xl">Accounts Receivable</h1>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground md:text-3xl">
          {formatCurrency(arTotal)} <span className="text-sm font-sans font-normal text-muted-foreground">outstanding</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Executed contracts only · invoice tracking</p>
      </header>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <ARStatCard
          href={href('pending')}
          title="Pending Invoicing"
          count={countFor('pending')}
          cents={pendingTotal}
          active={invoice === 'pending'}
        />
        <ARStatCard
          href={href('invoice_sent')}
          title="Invoice Sent"
          count={countFor('invoice_sent')}
          cents={sentTotal}
          active={invoice === 'invoice_sent'}
        />
        <ARStatCard href={href('paid')} title="Paid" count={countFor('paid')} cents={paidTotal} active={invoice === 'paid'} />
        <ARStatCard
          href={href('all')}
          title="Total AR Value"
          count={statsRows.length}
          cents={arTotal}
          subtitle="All executed"
          active={invoice === 'all'}
        />
      </div>

      <Card className="border-fest-600/15">
        <CardContent className="space-y-4 p-6">
          <form className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" action={base} method="get">
            {invoice !== 'all' ? <input type="hidden" name="invoice" value={invoice} /> : null}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <Input name="q" placeholder="Search company…" defaultValue={q} className="w-full md:w-56" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sales rep</label>
              <Input name="rep" placeholder="Name or email…" defaultValue={repQ} className="w-full md:w-56" />
            </div>
            <Button type="submit">Search</Button>
            {(q || repQ || invoice !== 'all') && (
              <Button variant="outline" type="button" asChild>
                <Link href={base}>Clear</Link>
              </Button>
            )}
          </form>

          <div className="flex flex-wrap gap-2 border-b border-border/60 pb-4">
            {(
              [
                { key: 'all' as const, label: 'All' },
                { key: 'pending' as const, label: formatInvoiceStatus('pending') },
                { key: 'invoice_sent' as const, label: formatInvoiceStatus('invoice_sent') },
                { key: 'paid' as const, label: formatInvoiceStatus('paid') },
              ] as const
            ).map((tab) => (
              <Link
                key={tab.key}
                href={href(tab.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  invoice === tab.key ? 'border-fest-700 bg-fest-50 text-fest-950' : 'border-border bg-background hover:bg-muted/60'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {contracts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No contracts match these filters.</p>
          ) : (
            <>
              <div className="divide-y divide-border/50 md:hidden">
                {contracts.map((c) => {
                  const ev = eventMap.get(c.event_id);
                  const inv = (c.invoice_status ?? 'pending') as InvoiceStatus;
                  return (
                    <Link
                      key={c.id}
                      href={`/accounting/${c.id}`}
                      className="block py-4 first:pt-0 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{c.exhibitor_company_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{ev?.name ?? '—'}</p>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${invoiceStatusBadgeClass(inv)}`}>
                          {formatInvoiceStatus(inv)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Executed</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => {
                      const ev = eventMap.get(c.event_id);
                      const inv = (c.invoice_status ?? 'pending') as InvoiceStatus;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.exhibitor_company_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ev?.name ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                          <TableCell className="text-sm">{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {c.executed_at ? formatTimestamp(c.executed_at) : '—'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invoiceStatusBadgeClass(inv)}`}>
                              {formatInvoiceStatus(inv)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link href={`/accounting/${c.id}`} className="text-accent-brand hover:underline">
                              →
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

