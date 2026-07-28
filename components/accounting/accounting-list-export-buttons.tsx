'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, Loader2, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountingPortalKey } from '@/lib/accounting-portal';

type ExportFormat = 'csv' | 'xlsx' | 'sheets';

export function AccountingListExportButtons({
  productKey,
  filters,
}: {
  productKey: AccountingPortalKey;
  filters: {
    invoice?: string;
    q?: string;
    rep?: string;
    event?: string;
    sort?: string;
    dir?: string;
  };
}) {
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  async function runExport(format: ExportFormat) {
    setPending(format);
    setMessage(null);
    if (format !== 'sheets') setSheetUrl(null);

    try {
      const res = await fetch('/api/accounting/export-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productKey,
          format,
          invoice: filters.invoice,
          q: filters.q,
          rep: filters.rep,
          event: filters.event,
          sort: filters.sort,
          dir: filters.dir,
        }),
      });

      if (format === 'sheets') {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(json.error ?? 'Google Sheets upload failed');
          setSheetUrl(null);
          return;
        }
        setSheetUrl(json.webViewLink ?? null);
        setMessage(
          `Uploaded ${json.rowCount ?? 0} row${json.rowCount === 1 ? '' : 's'} to Google Sheets (current filters).`,
        );
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(json.error ?? 'Download failed');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename =
        match?.[1] ??
        (format === 'xlsx' ? 'accounting.xlsx' : 'accounting.csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(format === 'xlsx' ? 'Excel download started.' : 'CSV download started.');
    } catch {
      setMessage(format === 'sheets' ? 'Google Sheets upload failed.' : 'Download failed.');
      if (format === 'sheets') setSheetUrl(null);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => runExport('csv')}
          disabled={Boolean(pending)}
        >
          {pending === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => runExport('xlsx')}
          disabled={Boolean(pending)}
        >
          {pending === 'xlsx' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => runExport('sheets')}
          disabled={Boolean(pending)}
        >
          {pending === 'sheets' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
          Upload to Google Sheets
        </Button>
      </div>
      {message ? (
        <p className="text-xs text-muted-foreground">
          {message}{' '}
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent-brand hover:underline"
            >
              Open spreadsheet
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
