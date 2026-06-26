import Link from 'next/link';
import { CheckCircle2, Clock, DollarSign, FileText, Send } from 'lucide-react';
import { requireAccountingPageAccess } from '@/lib/auth-accounting';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cn, formatCurrency, formatTimestamp } from '@/lib/utils';
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
import { ExportBilledButton } from '@/components/accounting/export-billed-button';

function portalChrome(productKey: AccountingPortalKey) {
  const isNywe = productKey === 'wine_spectator';
  return {
    cardBorder: isNywe ? 'border-rose-600/15' : 'border-fest-600/15',
    cardHeaderBorder: isNywe ? 'border-rose-600/10' : 'border-fest-600/10',
    activePill: isNywe
      ? 'border-rose-700 bg-rose-50 text-rose-950 ring-1 ring-rose-600/30'
      : 'border-fest-700 bg-fest-50 text-fest-950 ring-1 ring-fest-600/30',
    activeRing: isNywe ? 'ring-2 ring-rose-600/35' : 'ring-2 ring-fest-600/35',
  };
}

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
    contracts = contracts.filter((c) => {
      const blob = [
        c.exhibitor_company_name,
        c.billing_contact_name,
        c.billing_contact_email,
        c.signer_1_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(lower);
    });
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
  const showBillingColumns = productKey === 'wine_spectator';
  const chrome = portalChrome(productKey);

  const filterDescription = (() => {
    if (invoice === 'all' && !q && !repQ) {
      return `${allExecuted.length} executed contract${allExecuted.length === 1 ? '' : 's'} · showing up to 500`;
    }
    const parts: string[] = [];
    if (invoice !== 'all') parts.push(formatInvoiceStatus(invoice));
    if (q) parts.push(`company “${q}”`);
    if (repQ) parts.push(`rep “${repQ}”`);
    return `${contracts.length} match${contracts.length === 1 ? '' : 'es'} · ${parts.join(' · ')}`;
  })();

  return (
    <div className="space-y-10">
      <AccountingHero
        productKey={productKey}
        title={accountingPortalTitle(productKey)}
        subtitle={
          productKey === 'wine_spectator'
            ? 'Executed exhibitor contracts ready for invoicing and payment tracking'
            : 'Executed sponsor contracts ready for invoicing and payment tracking'
        }
        arTotalCents={sumFor('all')}
        pendingCount={countFor('pending')}
        sentCount={countFor('invoice_sent')}
        paidCount={countFor('paid')}
        dashboardBase={base}
      />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-medium text-foreground">Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ARStatCard
            href={href('pending')}
            title="Pending invoicing"
            count={countFor('pending')}
            cents={sumFor('pending')}
            active={invoice === 'pending'}
            icon={Clock}
            accent="amber"
            activeRingClass={chrome.activeRing}
          />
          <ARStatCard
            href={href('invoice_sent')}
            title="Invoice sent"
            count={countFor('invoice_sent')}
            cents={sumFor('invoice_sent')}
            active={invoice === 'invoice_sent'}
            icon={Send}
            accent="fest"
            activeRingClass={chrome.activeRing}
          />
          <ARStatCard
            href={href('paid')}
            title="Paid"
            count={countFor('paid')}
            cents={sumFor('paid')}
            active={invoice === 'paid'}
            icon={CheckCircle2}
            accent="emerald"
            activeRingClass={chrome.activeRing}
          />
          <ARStatCard
            href={href('all')}
            title={`Total ${portalLabel} AR`}
            count={countFor('all')}
            cents={sumFor('all')}
            subtitle="All executed"
            active={invoice === 'all'}
            icon={DollarSign}
            accent="whisky"
            activeRingClass={chrome.activeRing}
          />
        </div>
      </section>

      <Card className={cn('overflow-hidden', chrome.cardBorder)}>
        <div className={cn('flex flex-col gap-4 border-b px-6 py-4 sm:flex-row sm:items-end sm:justify-between', chrome.cardHeaderBorder)}>
          <div>
            <h2 className="font-serif text-lg font-semibold">Executed contracts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{filterDescription}</p>
          </div>
          <ExportBilledButton productKey={productKey} />
        </div>

        <div className="space-y-4 border-b border-border/50 px-6 py-4">
          <form className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" action={base} method="get">
            {invoice !== 'all' ? <input type="hidden" name="invoice" value={invoice} /> : null}
            <div className="min-w-0 flex-1 space-y-1.5 md:max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input
                name="q"
                placeholder={showBillingColumns ? 'Company, billing name, or email…' : 'Company or contact…'}
                defaultValue={q}
              />
            </div>
            {showSalesRep ? (
              <div className="min-w-0 space-y-1.5 md:max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">Sales rep</label>
                <Input name="rep" placeholder="Name or email…" defaultValue={repQ} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Search</Button>
              {(q || repQ || invoice !== 'all') && (
                <Button variant="outline" type="button" asChild>
                  <Link href={base}>Clear</Link>
                </Button>
              )}
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
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
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                  invoice === tab.key ? chrome.activePill : 'border-border bg-background hover:bg-muted/60'
                }`}
              >
                {tab.label}
                <span className="font-mono tabular-nums opacity-80">{countFor(tab.key)}</span>
              </Link>
            ))}
          </div>
        </div>

        <CardContent className="p-0">
          {contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-lg font-semibold">No contracts match these filters</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Try another status or clear search filters to see executed {portalLabel} contracts.
              </p>
              {(q || repQ || invoice !== 'all') && (
                <Button variant="outline" className="mt-6" asChild>
                  <Link href={base}>Clear filters</Link>
                </Button>
              )}
            </div>
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
                      className="block px-4 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{c.exhibitor_company_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{ev?.name ?? '—'}</p>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {showBillingColumns && c.billing_contact_name ? <span>{c.billing_contact_name}</span> : null}
                        {showBillingColumns && c.billing_contact_email ? (
                          <span className="truncate font-mono">{c.billing_contact_email}</span>
                        ) : null}
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
                <Table className="[&_tbody_tr:hover]:bg-muted/40">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      {showBillingColumns ? (
                        <>
                          <TableHead>Billing contact</TableHead>
                          <TableHead>Billing email</TableHead>
                        </>
                      ) : null}
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {showSalesRep ? <TableHead>Sales rep</TableHead> : null}
                      <TableHead>Executed</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => {
                      const ev = eventMap.get(c.event_id);
                      const inv = (c.invoice_status ?? 'pending') as InvoiceStatus;
                      return (
                        <TableRow key={c.id} className="group">
                          <TableCell>
                            <Link href={`/accounting/${c.id}`} className="block font-medium hover:text-accent-brand">
                              {c.exhibitor_company_name}
                            </Link>
                          </TableCell>
                          {showBillingColumns ? (
                            <>
                              <TableCell className="text-sm">{c.billing_contact_name?.trim() || '—'}</TableCell>
                              <TableCell className="max-w-[12rem] truncate text-sm font-mono text-muted-foreground">
                                {c.billing_contact_email ?? '—'}
                              </TableCell>
                            </>
                          ) : null}
                          <TableCell className="text-sm text-muted-foreground">{ev?.name ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums font-semibold">
                            {formatCurrency(c.grand_total_cents)}
                          </TableCell>
                          {showSalesRep ? (
                            <TableCell className="text-sm text-muted-foreground">
                              {c.sales_rep_name ?? c.sales_rep_email ?? '—'}
                            </TableCell>
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
                            <Link
                              href={`/accounting/${c.id}`}
                              className="text-accent-brand opacity-0 transition-opacity group-hover:opacity-100"
                            >
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
