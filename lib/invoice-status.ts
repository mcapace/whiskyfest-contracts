import type { InvoiceStatus } from '@/types/db';

export function formatInvoiceStatus(status: InvoiceStatus | string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'invoice_sent':
      return 'Invoice Sent';
    case 'paid':
      return 'Paid';
    default:
      return String(status);
  }
}

export function invoiceStatusBadgeClass(status: InvoiceStatus | string): string {
  switch (status) {
    case 'pending':
      return 'border border-amber-300 bg-amber-100 text-amber-900';
    case 'invoice_sent':
      return 'border border-blue-300 bg-blue-100 text-blue-900';
    case 'paid':
      return 'border border-emerald-300 bg-emerald-100 text-emerald-900';
    default:
      return 'border border-gray-300 bg-gray-100 text-gray-800';
  }
}
