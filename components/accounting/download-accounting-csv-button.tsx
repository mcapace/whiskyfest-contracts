'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AccountingCsvRow = {
  company: string;
  event: string;
  billingContact: string;
  billingEmail: string;
  total: string;
  salesRep?: string;
  executed: string;
  invoiceStatus: string;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function DownloadAccountingCsvButton({
  rows,
  filename,
  includeSalesRep,
}: {
  rows: AccountingCsvRow[];
  filename: string;
  includeSalesRep: boolean;
}) {
  function handleDownload() {
    const headers = [
      'Company',
      'Event',
      'Billing contact',
      'Billing email',
      'Total',
      ...(includeSalesRep ? ['Sales rep'] : []),
      'Executed',
      'Invoice status',
    ];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.company,
          r.event,
          r.billingContact,
          r.billingEmail,
          r.total,
          ...(includeSalesRep ? [r.salesRep ?? ''] : []),
          r.executed,
          r.invoiceStatus,
        ]
          .map((cell) => csvEscape(cell))
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={rows.length === 0}>
      <Download className="h-4 w-4" />
      Download CSV
    </Button>
  );
}
