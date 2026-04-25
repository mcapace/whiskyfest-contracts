'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import type { SponsorRecord } from '@/lib/sponsors';

export function SponsorProfileDrawer({
  open,
  onOpenChange,
  sponsor,
  canViewFinancials,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsor: SponsorRecord | null;
  canViewFinancials: boolean;
}) {
  if (!sponsor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-medium text-oak-800">{sponsor.exhibitor_company_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-ink-700">
          <p>Status: <span className="font-medium capitalize">{sponsor.status.replaceAll('_', ' ')}</span></p>
          <p>Booths: <span className="tabular-nums font-medium">{sponsor.booth_count}</span></p>
          <p>Sales rep: <span className="font-medium">{sponsor.sales_rep_name ?? sponsor.sales_rep_email ?? '—'}</span></p>
          <p>Signer: <span className="font-medium">{sponsor.signer_1_name ?? sponsor.signer_1_email ?? '—'}</span></p>
          {canViewFinancials ? (
            <p>Contract value: <span className="tabular-nums font-semibold text-oak-800">{formatCurrency(sponsor.grand_total_cents)}</span></p>
          ) : (
            <p className="text-ink-500">Contract value is restricted for your role.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
