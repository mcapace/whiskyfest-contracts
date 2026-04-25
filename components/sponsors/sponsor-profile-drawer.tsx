'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency, formatRelative } from '@/lib/utils';
import type { SponsorRecord } from '@/lib/sponsors';

export function SponsorProfileDrawer({
  open,
  onOpenChange,
  sponsor,
  canViewSensitive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sponsor: SponsorRecord | null;
  canViewSensitive: boolean;
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
          <p>Brands: <span className="font-medium">{sponsor.brands_poured?.trim() || '—'}</span></p>

          {canViewSensitive ? (
            <>
              <p>Contract value: <span className="tabular-nums font-semibold text-oak-800">{formatCurrency(sponsor.grand_total_cents)}</span></p>
              <p>Signer contact: <span className="font-medium">{sponsor.signer_1_name ?? sponsor.signer_1_email ?? '—'}</span></p>
              <div className="space-y-1">
                <p className="font-medium text-oak-800">Billing info</p>
                <p className="text-xs text-ink-600">
                  {sponsor.billing_contact_name ?? '—'} · {sponsor.billing_contact_email ?? '—'}
                </p>
                <p className="text-xs text-ink-600">
                  Event contact: {sponsor.event_contact_name ?? '—'} · {sponsor.event_contact_email ?? '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-oak-800">Activity log</p>
                {sponsor.activity.length > 0 ? (
                  <ul className="space-y-1 text-xs text-ink-600">
                    {sponsor.activity.slice(0, 5).map((a) => (
                      <li key={a.id}>
                        {a.action.replaceAll('_', ' ')} · {formatRelative(a.occurred_at)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-600">No recent activity.</p>
                )}
              </div>
            </>
          ) : (
            <p className="italic text-ink-500">Contact and financial information is restricted.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
