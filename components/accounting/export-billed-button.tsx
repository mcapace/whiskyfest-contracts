'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccountingPortalKey } from '@/lib/accounting-portal';

export function ExportBilledButton({ productKey }: { productKey: AccountingPortalKey }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/accounting/export-billed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(json.error ?? 'Export failed');
        setSheetUrl(null);
        return;
      }
      setSheetUrl(json.webViewLink ?? null);
      setMessage(
        `Exported ${json.rowCount ?? 0} billed ${json.rowCount === 1 ? 'exhibitor' : 'exhibitors'} to Google Sheets.`,
      );
    } catch {
      setMessage('Export failed — check your connection and try again.');
      setSheetUrl(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
        Export billed to Google Sheets
      </Button>
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
