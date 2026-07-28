import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Clock, DollarSign, FileText, Send, Ban, CircleSlash } from 'lucide-react';
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
import { AccountingListExportButtons } from '@/components/accounting/accounting-list-export-buttons';

const DISPLAY_CAP = 500;

type SortKey = 'company' | 'event' | 'total' | 'executed' | 'invoice' | 'rep';
type SortDir = 'asc' | 'desc';

function portalChrome(productKey: AccountingPortalKey) {
  const isNywe = productKey === 'wine_spectator';
  const isBigSmoke = productKey === 'big_smoke';
  return {
    cardBorder: isNywe
      ? 'border-rose-600/15'
      : isBigSmoke
        ? 'border-amber-700/20'
        : 'border-fest-600/15',
    cardHeaderBorder: isNywe
      ? 'border-rose-600/10'
      : isBigSmoke
        ? 'border-amber-700/15'
        : 'border-fest-600/10',
    activePill: isNywe
      ? 'border-rose-700 bg-rose-50 text-rose-950 ring-1 ring-rose-600/30'
      : isBigSmoke
        ? 'border-amber-800 bg-amber-50 text-amber-950 ring-1 ring-amber-700/30'
        : 'border-fest-700 bg-fest-50 text-fest-950 ring-1 ring-fest-600/30',
    activeRing: isNywe
      ? 'ring-2 ring-rose-600/35'
      : isBigSmoke
        ? 'ring-2 ring-amber-700/35'
        : 'ring-2 ring-fest-600/35',
  };
}

function parseSortKey(raw: string | undefined): SortKey {
  if (raw === 'company' || raw === 'event' || raw === 'total' || raw === 'executed' || raw === 'invoice' || raw === 'rep') {
    return raw;
  }
  return 'executed';
}

function parseSortDir(raw: string | undefined, sort: SortKey): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw;
  return sort === 'company' || sort === 'event' || sort === 'rep' ? 'asc' : 'desc';
}

function invoiceSortRank(status: InvoiceStatus): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'invoice_sent':
      return 1;
    case 'paid':
      return 2;
    case 'invoice_voided':
      return 3;
    case 'not_invoiced':
      return 4;
    default:
      return 9;
  }
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  activeDir,
  hrefFor,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  hrefFor: (key: SortKey) => string;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  const Icon = !active ? ArrowUpDown : activeDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <Link
        href={hrefFor(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 font-medium hover:text-foreground',
          align === 'right' && 'justify-end',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </Link>
    </TableHead>
  );
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
  const eventId = typeof searchParams?.event === 'string' ? searchParams.event.trim() : '';
  const sort = parseSortKey(typeof searchParams?.sort === 'string' ? searchParams.sort : undefined);
  const dir = parseSortDir(typeof searchParams?.dir === 'string' ? searchParams.dir : undefined, sort);

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
  const eventMap = new Map(events.map((e) => [e.id, e]));

  const eventOptions = [...new Map(
    allExecuted
      .map((c) => {
        const ev = eventMap.get(c.event_id);
        return ev ? ([ev.id, ev] as const) : null;
      })
      .filter((row): row is readonly [string, Event] => Boolean(row)),
  ).values()].sort((a, b) => a.name.localeCompare(b.name) || b.year - a.year);

  let contracts = allExecuted;
  if (invoice !== 'all') {
    contracts = contracts.filter((c) => (c.invoice_status ?? 'pending') === invoice);
  }
  if (eventId) {
    contracts = contracts.filter((c) => c.event_id === eventId);
  }
  if (q) {
    const lower = q.toLowerCase();
    contracts = contracts.filter((c) => {
      const blob = [
        c.exhibitor_company_name,
        c.billing_contact_name,
        c.billing_contact_email,
        c.signer_1_name,
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

  const filteredCount = contracts.length;

  contracts = [...contracts].sort((a, b) => {
    const mul = dir === 'asc' ? 1 : -1;
    const evA = eventMap.get(a.event_id)?.name ?? '';
    const evB = eventMap.get(b.event_id)?.name ?? '';
    let cmp = 0;
    switch (sort) {
      case 'company':
        cmp = a.exhibitor_company_name.localeCompare(b.exhibitor_company_name);
        break;
      case 'event':
        cmp = evA.localeCompare(evB);
        break;
      case 'total':
        cmp = (a.grand_total_cents ?? 0) - (b.grand_total_cents ?? 0);
        break;
      case 'executed':
        cmp = (a.executed_at ?? '').localeCompare(b.executed_at ?? '');
        break;
      case 'invoice':
        cmp =
          invoiceSortRank((a.invoice_status ?? 'pending') as InvoiceStatus) -
          invoiceSortRank((b.invoice_status ?? 'pending') as InvoiceStatus);
        break;
      case 'rep':
        cmp = (a.sales_rep_name ?? a.sales_rep_email ?? '').localeCompare(
          b.sales_rep_name ?? b.sales_rep_email ?? '',
        );
        break;
    }
    if (cmp !== 0) return cmp * mul;
    return (b.executed_at ?? '').localeCompare(a.executed_at ?? '');
  });

  const displayed = contracts.slice(0, DISPLAY_CAP);

  const sumFor = (inv: InvoiceStatus | 'all') =>
    allExecuted
      .filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv)
      .reduce((a, r) => a + (r.grand_total_cents ?? 0), 0);

  const countFor = (inv: InvoiceStatus | 'all') =>
    allExecuted.filter((r) => inv === 'all' || (r.invoice_status ?? 'pending') === inv).length;

  const base = accountingDashboardHref(productKey);
  const showSalesRep = productKey !== 'wine_spectator';
  const chrome = portalChrome(productKey);
  const portalLabel = accountingPortalLabel(productKey);

  function buildParams(overrides: Record<string, string | null | undefined> = {}) {
    const p = new URLSearchParams();
    const values: Record<string, string | undefined> = {
      invoice: invoice === 'all' ? undefined : invoice,
      q: q || undefined,
      rep: showSalesRep ? repQ || undefined : undefined,
      event: eventId || undefined,
      sort: sort === 'executed' ? undefined : sort,
      dir: overrides.dir === undefined && sort === 'executed' && dir === 'desc' ? undefined : dir,
      ...overrides,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value == null || value === '') continue;
      if (key === 'invoice' && value === 'all') continue;
      p.set(key, value);
    }
    return p;
  }

  function hrefWith(overrides: Record<string, string | null | undefined> = {}) {
    const s = buildParams(overrides).toString();
    return s ? `${base}?${s}` : base;
  }

  function href(inv: InvoiceStatus | 'all') {
    return hrefWith({ invoice: inv === 'all' ? null : inv });
  }

  function sortHref(key: SortKey) {
    const nextDir: SortDir =
      sort === key ? (dir === 'asc' ? 'desc' : 'asc') : key === 'company' || key === 'event' || key === 'rep' ? 'asc' : 'desc';
    return hrefWith({ sort: key, dir: nextDir });
  }

  const hasActiveFilters = Boolean(q || repQ || eventId || invoice !== 'all');

  const filterDescription = (() => {
    const parts: string[] = [];
    if (invoice !== 'all') parts.push(formatInvoiceStatus(invoice));
    if (eventId) {
      const ev = eventMap.get(eventId);
      parts.push(ev ? ev.name : 'selected event');
    }
    if (q) parts.push(`search “${q}”`);
    if (repQ) parts.push(`rep “${repQ}”`);
    const shown =
      filteredCount > DISPLAY_CAP
        ? `Showing ${DISPLAY_CAP} of ${filteredCount}`
        : `${filteredCount} contract${filteredCount === 1 ? '' : 's'}`;
    if (parts.length === 0) {
      return `${shown} · sorted by ${sort} (${dir})`;
    }
    return `${shown} · ${parts.join(' · ')} · sorted by ${sort} (${dir})`;
  })();

  const exportFilters = {
    invoice: invoice === 'all' ? undefined : invoice,
    q: q || undefined,
    rep: showSalesRep ? repQ || undefined : undefined,
    event: eventId || undefined,
    sort: sort === 'executed' ? undefined : sort,
    dir: sort === 'executed' && dir === 'desc' ? undefined : dir,
  };

  return (
    <div className="space-y-10">
      <AccountingHero
        productKey={productKey}
        title={accountingPortalTitle(productKey)}
        subtitle={
          productKey === 'wine_spectator'
            ? 'Executed exhibitor contracts ready for invoicing and payment tracking'
            : productKey === 'big_smoke'
              ? 'Executed Big Smoke exhibitor contracts ready for invoicing and payment tracking'
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            href={href('invoice_voided')}
            title="Invoice voided"
            count={countFor('invoice_voided')}
            cents={sumFor('invoice_voided')}
            active={invoice === 'invoice_voided'}
            icon={CircleSlash}
            accent="rose"
            activeRingClass={chrome.activeRing}
          />
          <ARStatCard
            href={href('not_invoiced')}
            title="Do not invoice"
            count={countFor('not_invoiced')}
            cents={sumFor('not_invoiced')}
            active={invoice === 'not_invoiced'}
            icon={Ban}
            accent="whisky"
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
        <div
          className={cn(
            'flex flex-col gap-4 border-b px-6 py-4 lg:flex-row lg:items-end lg:justify-between',
            chrome.cardHeaderBorder,
          )}
        >
          <div>
            <h2 className="font-serif text-lg font-semibold">Executed contracts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{filterDescription}</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <AccountingListExportButtons productKey={productKey} filters={exportFilters} />
            <ExportBilledButton productKey={productKey} />
          </div>
        </div>

        <div className="space-y-4 border-b border-border/50 px-6 py-4">
          <form className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end" action={base} method="get">
            {invoice !== 'all' ? <input type="hidden" name="invoice" value={invoice} /> : null}
            {sort !== 'executed' ? <input type="hidden" name="sort" value={sort} /> : null}
            {(sort !== 'executed' || dir !== 'desc') && dir ? (
              <input type="hidden" name="dir" value={dir} />
            ) : null}
            <div className="min-w-0 flex-1 space-y-1.5 md:max-w-xs">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input name="q" placeholder="Company, billing name, or email…" defaultValue={q} />
            </div>
            {eventOptions.length > 0 ? (
              <div className="min-w-0 space-y-1.5 md:max-w-xs">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="accounting-event">
                  Event
                </label>
                <select
                  id="accounting-event"
                  name="event"
                  defaultValue={eventId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All events</option>
                  {eventOptions.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                      {ev.year ? ` (${ev.year})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {showSalesRep ? (
              <div className="min-w-0 space-y-1.5 md:max-w-xs">
                <label className="text-xs font-medium text-muted-foreground">Sales rep</label>
                <Input name="rep" placeholder="Name or email…" defaultValue={repQ} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Apply filters</Button>
              {hasActiveFilters ? (
                <Button variant="outline" type="button" asChild>
                  <Link href={base}>Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'all' as const, label: 'All' },
                { key: 'pending' as const, label: formatInvoiceStatus('pending') },
                { key: 'invoice_sent' as const, label: formatInvoiceStatus('invoice_sent') },
                { key: 'paid' as const, label: formatInvoiceStatus('paid') },
                { key: 'invoice_voided' as const, label: formatInvoiceStatus('invoice_voided') },
                { key: 'not_invoiced' as const, label: formatInvoiceStatus('not_invoiced') },
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
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-serif text-lg font-semibold">No contracts match these filters</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Try another status, event, or clear search filters to see executed {portalLabel} contracts.
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" className="mt-6" asChild>
                  <Link href={base}>Clear filters</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50 md:hidden">
                {displayed.map((c) => {
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
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {formatCurrency(c.grand_total_cents)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {c.billing_contact_name ? <span>{c.billing_contact_name}</span> : null}
                        {c.billing_contact_email ? (
                          <span className="truncate font-mono">{c.billing_contact_email}</span>
                        ) : null}
                        {showSalesRep ? <span>{c.sales_rep_name ?? c.sales_rep_email ?? '—'}</span> : null}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${invoiceStatusBadgeClass(inv)}`}
                        >
                          {formatInvoiceStatus(inv)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table className="[&_tbody_tr:hover]:bg-muted/40">
                  <TableHeader>
                    <TableRow>
                      <SortableHead
                        label="Company"
                        sortKey="company"
                        activeKey={sort}
                        activeDir={dir}
                        hrefFor={sortHref}
                      />
                      <TableHead>Billing contact</TableHead>
                      <TableHead>Billing email</TableHead>
                      <SortableHead
                        label="Event"
                        sortKey="event"
                        activeKey={sort}
                        activeDir={dir}
                        hrefFor={sortHref}
                      />
                      <SortableHead
                        label="Total"
                        sortKey="total"
                        activeKey={sort}
                        activeDir={dir}
                        hrefFor={sortHref}
                        align="right"
                      />
                      {showSalesRep ? (
                        <SortableHead
                          label="Sales rep"
                          sortKey="rep"
                          activeKey={sort}
                          activeDir={dir}
                          hrefFor={sortHref}
                        />
                      ) : null}
                      <SortableHead
                        label="Executed"
                        sortKey="executed"
                        activeKey={sort}
                        activeDir={dir}
                        hrefFor={sortHref}
                      />
                      <SortableHead
                        label="Invoice status"
                        sortKey="invoice"
                        activeKey={sort}
                        activeDir={dir}
                        hrefFor={sortHref}
                      />
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map((c) => {
                      const ev = eventMap.get(c.event_id);
                      const inv = (c.invoice_status ?? 'pending') as InvoiceStatus;
                      return (
                        <TableRow key={c.id} className="group">
                          <TableCell>
                            <Link
                              href={`/accounting/${c.id}`}
                              className="block font-medium hover:text-accent-brand"
                            >
                              {c.exhibitor_company_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">{c.billing_contact_name?.trim() || '—'}</TableCell>
                          <TableCell className="max-w-[12rem] truncate text-sm font-mono text-muted-foreground">
                            {c.billing_contact_email ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{ev?.name ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
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
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invoiceStatusBadgeClass(inv)}`}
                            >
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
              {filteredCount > DISPLAY_CAP ? (
                <p className="border-t border-border/50 px-6 py-3 text-xs text-muted-foreground">
                  Showing the first {DISPLAY_CAP} of {filteredCount} matching contracts. Narrow filters or download CSV
                  for the visible page; Export billed includes all invoiced rows in Sheets.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
