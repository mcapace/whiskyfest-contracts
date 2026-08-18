'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MousePointerClick, QrCode, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { RelativeTime } from '@/components/ui/relative-time';
import { NyweBoothQrBookButton } from '@/components/wine-spectator/nywe-booth-qr-book-button';
import { NyweBoothQrRowDownload } from '@/components/wine-spectator/nywe-booth-qr-row-download';
import { NyweBoothQrUrlEditor } from '@/components/wine-spectator/nywe-booth-qr-url-editor';
import { cn } from '@/lib/utils';

export type NyweBoothQrPageRow = {
  id: string;
  exhibitorCompanyName: string;
  websiteUrl: string | null;
  shortUrl: string | null;
  clicks: number;
  lastClickAt: string | null;
};

type FilterKey = 'all' | 'missing' | 'ready' | 'scans';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All executed' },
  { key: 'missing', label: 'Need website' },
  { key: 'ready', label: 'Ready to print' },
  { key: 'scans', label: 'With scans' },
];

export function NyweBoothQrWorkspace({
  eventName,
  eventYear,
  rows,
}: {
  eventName: string;
  eventYear: number;
  rows: NyweBoothQrPageRow[];
}) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateNote, setGenerateNote] = useState<string | null>(null);
  const router = useRouter();

  const needsLinks = rows.some((row) => Boolean(row.websiteUrl) && !row.shortUrl);
  const needsWebsites = rows.some((row) => !row.websiteUrl);
  const needsSync = needsLinks || needsWebsites;

  useEffect(() => {
    if (!needsSync) return;
    let cancelled = false;
    async function createMissingLinks() {
      setGenerating(true);
      setGenerateNote(
        needsWebsites
          ? 'Checking the exhibitor sheet for new websites…'
          : 'Creating winespectator.live short links…',
      );
      try {
        for (let i = 0; i < 12; i += 1) {
          const res = await fetch('/api/wine-spectator/booth-qr-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ syncSheet: i === 0 && needsWebsites }),
          });
          const json = (await res.json().catch(() => ({}))) as {
            remaining?: number;
            created?: number;
            websitesUpdated?: number;
            error?: string;
            errors?: string[];
          };
          if (!res.ok) {
            setGenerateNote(json.error ?? 'Could not refresh websites or short links.');
            break;
          }
          if (cancelled) return;
          if ((json.websitesUpdated ?? 0) > 0) {
            setGenerateNote(
              `Picked up ${json.websitesUpdated} website${json.websitesUpdated === 1 ? '' : 's'} from the sheet…`,
            );
          }
          const remaining = json.remaining ?? 0;
          if (remaining > 0) {
            setGenerateNote(`Creating winespectator.live short links… ${remaining} left`);
          } else if ((json.created ?? 0) > 0 || (json.websitesUpdated ?? 0) > 0) {
            setGenerateNote('Websites and short links updated.');
          }
          if (remaining <= 0) break;
        }
        if (!cancelled) router.refresh();
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }
    void createMissingLinks();
    return () => {
      cancelled = true;
    };
  }, [needsSync, needsWebsites, router]);

  const executedCount = rows.length;
  const readyCount = rows.filter((row) => Boolean(row.websiteUrl)).length;
  const missingCount = executedCount - readyCount;
  const generatedCount = rows.filter((row) => Boolean(row.shortUrl)).length;
  const totalScans = rows.reduce((sum, row) => sum + row.clicks, 0);
  const scannedCount = rows.filter((row) => row.clicks > 0).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (filter === 'missing' && row.websiteUrl) return false;
      if (filter === 'ready' && !row.websiteUrl) return false;
      if (filter === 'scans' && row.clicks <= 0) return false;
      if (q && !row.exhibitorCompanyName.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...next].sort((a, b) =>
      a.exhibitorCompanyName.localeCompare(b.exhibitorCompanyName, undefined, { sensitivity: 'base' }),
    );
  }, [rows, filter, query]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-fest-600/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="wf-label-caps text-[0.65rem] text-fest-800">Booth signs</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foreground">QR codes</h1>
          <p className="mt-2 nywe-subhead text-sm text-muted-foreground">
            {eventName} — print files and scan tracking for executed vendor&nbsp;licenses.
          </p>
          {generating || generateNote ? (
            <p className="mt-2 text-xs text-muted-foreground">{generateNote}</p>
          ) : null}
        </div>
        <NyweBoothQrBookButton readyCount={readyCount} eventYear={eventYear} />
      </div>

      <div className="rounded-xl border border-fest-600/15 bg-muted/20 px-4 py-3 text-sm leading-snug text-muted-foreground">
        <p className="font-medium text-foreground">How to use booth QRs</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>We print a Wine Spectator QR for each executed vendor license. Do not use a QR the winery designed.</li>
          <li>
            The QR always goes through our <span className="whitespace-nowrap">winespectator.live</span> short link. The
            winery can give a URL with UTM tags; we cannot accept a QR file they created.
          </li>
          <li>
            To add or change a destination URL (UTMs included):
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Paste it in the Website column on this page and click Save — the row switches to Download.</li>
              <li>
                Or update <strong className="font-medium text-foreground">WINERY WEBSITE URL</strong> on the exhibitor
                sheet. This page checks the sheet when you open it.
              </li>
            </ul>
          </li>
          <li>
            <strong className="font-medium text-foreground">Preview</strong> shows the QR on screen so you can scan it
            before printing. Then download PNG or SVG.
          </li>
          <li>
            <strong className="font-medium text-foreground">Download QR book</strong> builds a PDF plus PNG/SVG files for
            every license that has a website.
          </li>
          <li>Scan counts on this page are from our winespectator.live short links.</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          icon={QrCode}
          label="Executed licenses"
          value={String(executedCount)}
          sub={`${readyCount} ready to print · ${missingCount} need a website`}
          accent="fest"
        />
        <DashboardStatCard
          icon={QrCode}
          label="Short links"
          value={String(generatedCount)}
          sub="winespectator.live codes created"
          accent="whisky"
        />
        <DashboardStatCard
          icon={MousePointerClick}
          label="Total scans"
          value={String(totalScans)}
          sub={`${scannedCount} winery QR${scannedCount === 1 ? '' : 's'} scanned`}
          accent="emerald"
        />
        <DashboardStatCard
          icon={Search}
          label="Need a website"
          value={String(missingCount)}
          sub="Add a URL on the contract before printing"
          accent="amber"
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search winery"
              className="h-9 border-border/70 bg-background pl-8 shadow-none"
              aria-label="Search booth QR wineries"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  'h-9 whitespace-nowrap rounded-md border px-3 text-xs font-medium',
                  filter === item.key
                    ? item.key === 'missing'
                      ? 'border-amber-700 bg-amber-100 text-amber-950'
                      : 'border-fest-700 bg-fest-50 text-fest-900'
                    : item.key === 'missing' && missingCount > 0
                      ? 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
                      : 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {item.key === 'missing' ? ` (${missingCount})` : null}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Winery</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Short link</TableHead>
                <TableHead className="text-right">Scans</TableHead>
                <TableHead className="text-right">Last scan</TableHead>
                <TableHead className="text-right">QR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No executed licenses match this view.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const missing = !row.websiteUrl;
                  return (
                  <TableRow
                    key={row.id}
                    className={missing ? 'bg-amber-50/90 hover:bg-amber-100/80' : undefined}
                  >
                    <TableCell>
                      <Link
                        href={`/wine-spectator/contracts/${row.id}`}
                        className="font-medium hover:text-accent-brand"
                      >
                        {row.exhibitorCompanyName}
                      </Link>
                      {missing ? (
                        <p className="mt-0.5 text-[11px] font-medium text-amber-900">Missing website</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">
                      <NyweBoothQrUrlEditor contractId={row.id} websiteUrl={row.websiteUrl} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.shortUrl ? row.shortUrl.replace(/^https?:\/\//, '') : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.clicks}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {row.lastClickAt ? <RelativeTime iso={row.lastClickAt} /> : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <NyweBoothQrRowDownload
                        contractId={row.id}
                        exhibitorName={row.exhibitorCompanyName}
                        websiteUrl={row.websiteUrl}
                        shortUrl={row.shortUrl}
                        missingHref={`/wine-spectator/contracts/${row.id}`}
                      />
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} shown · executed vendor licenses only
        </p>
      </div>
    </div>
  );
}
