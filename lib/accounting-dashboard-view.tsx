import Link from 'next/link';
import { requireAccountingPageAccess } from '@/lib/auth-accounting';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatInvoiceStatus, invoiceStatusBadgeClass } from '@/lib/invoice-status';
import {
  accountingDashboardHref,
  accountingPortalLabel,
  accountingPortalTitle,
  filterContractsByAccountingPortal,
  parseInvoiceFilter,
  type AccountingPortalKey,
} from '@/lib/accounting-portal';
import { ARStatCard } from '@/components/accounting/ar-stat-card';
import { AccountingHero } from '@/components/dashboard/accounting-hero';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

export async function AccountingDashboardView({
  productKey,
  searchParams,
}: {
  productKey: AccountingPortalKey;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAccountingPageAccess();

  const invoice = parseInvoiceFilter(typeof searchParams?.invoice === 'string' ? searchParams.invoice : undefined);
  const q = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';
  const repQ = typeof searchParams?.rep === 'string' ? searchParams.rep.trim() : '';

  const supabase = getSupabaseAdmin();
  const [{ data: eventsData }, { data: allExecutedRows }] = await Promise.all([
    supabase.from('events').select('*'),
    supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('status', 'executed')
      .order('executed_at', { ascending: false })
      .limit(2000),
  ]);

  const events = (eventsData ?? []) as Event[];
  const allExecuted = filterContractsByAccountingPortal(
    (allExecutedRows ?? []) as ContractWithTotals[],
    events,
    productKey,
  );

  let contracts = allExecuted;
  if (invoice !== 'all') {
    contracts = contracts.filter((c) => (c.invoice_status ?? 'pending') === invoice);
  }
  if (q) {
    const lower = q.toLowerCase();
    contracts = contracts.filter((c) => c.exhibitor_company_name.toLowerCase().includes(lower));
  }
  if (repQ) {
    const lower = repQ.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        (c.sales_rep_name ?? '').toLowerCase().includes(lower) ||
        (c.sales_rep_email ?? '').toLowerCase().includes(lower),
    );
  }

  contracts = contracts.slice(0, 500);
  const eventMap = new Map(events.map((e) => [e.id, e]));

  const sumFor = (inv: InvoiceStatus | 'all') =>
    allExecuted
      .filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv)
      .reduce((a, r) => a + (r.grand_total_cents ?? 0), 0);

  const countFor = (inv: InvoiceStatus | 'all') =>
    allExecuted.filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv).length;

  const base = accountingDashboardHref(productKey);
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

  const portalLabel = accountingPortalLabel(productKey);
  const showSalesRep = productKey !== 'wine_spectator';

  return (
    <div className="space-y-10">
      <AccountingHero
        productKey={productKey}
        title={accountingPortalTitle(productKey)}
        subtitle={
          productKey === 'wine_spectator'
            ? 'New York Wine Experience vendor licenses ready for invoicing'
            : 'WhiskyFest sponsor contracts ready for invoicing'
        }
        arTotalCents={sumFor('all')}
        pendingCount={countFor('pending')}
        sentCount={countFor('invoice_sent')}
        paidCount={countFor('paid')}
        dashboardBase={base}
      />

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <ARStatCard
          href={href('pending')}
          title="Pending Invoicing"
          count={countFor('pending')}
          cents={sumFor('pending')}
          active={invoice === 'pending'}
        />
        <ARStatCard
          href={href('invoice_sent')}
          title="Invoice Sent"
          count={countFor('invoice_sent')}
          cents={sumFor('invoice_sent')}
          active={invoice === 'invoice_sent'}
        />
        <ARStatCard href={href('paid')} title="Paid" count={countFor('paid')} cents={sumFor('paid')} active={invoice === 'paid'} />
        <ARStatCard
          href={href('all')}
          title={`Total ${portalLabel} AR`}
          count={countFor('all')}
          cents={sumFor('all')}
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
            {showSalesRep ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sales rep</label>
                <Input name="rep" placeholder="Name or email…" defaultValue={repQ} className="w-full md:w-56" />
              </div>
            ) : null}
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
            <p className="py-12 text-center text-sm text-muted-foreground">
              No {portalLabel} contracts match these filters.
            </p>
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
                        {showSalesRep ? <span>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</span> : null}
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
                      {showSalesRep ? <TableHead>Sales Rep</TableHead> : null}
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
                          {showSalesRep ? (
                            <TableCell className="text-sm">{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</TableCell>
                          ) : null}
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
