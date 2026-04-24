'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserRole } from '@/types/db';

export function AccessRequestReviewForm({
  requestId,
  token,
  defaultAction,
}: {
  requestId: string;
  token: string;
  defaultAction: 'approve' | 'deny';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>(defaultAction === 'deny' ? 'reject' : 'approve');
  const [role, setRole] = useState<UserRole>('sales');
  const [eventsTeam, setEventsTeam] = useState(false);
  const [accounting, setAccounting] = useState(false);
  const [impersonation, setImpersonation] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [reason, setReason] = useState('');

  const submitLabel = useMemo(() => (action === 'approve' ? 'Confirm approval' : 'Confirm denial'), [action]);

  function onSubmit() {
    setErr(null);
    startTransition(async () => {
      const payload =
        action === 'approve'
          ? {
              action: 'approve',
              token,
              role,
              is_events_team: eventsTeam,
              is_accounting: accounting,
              can_impersonate: impersonation,
              send_email: sendEmail,
            }
          : {
              action: 'reject',
              token,
              reason: reason.trim() || undefined,
              send_email: sendEmail,
            };

      const res = await fetch(`/api/admin/access-requests/${requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof body.error === 'string' ? body.error : 'Request failed');
        return;
      }
      const status = action === 'approve' ? 'approved' : 'rejected';
      router.push(`/admin/access-requests?done=${status}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button type="button" variant={action === 'approve' ? 'default' : 'outline'} onClick={() => setAction('approve')}>
          Approve
        </Button>
        <Button type="button" variant={action === 'reject' ? 'destructive' : 'outline'} onClick={() => setAction('reject')}>
          Deny
        </Button>
      </div>

      {action === 'approve' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="sales">sales</SelectItem>
                <SelectItem value="sales_rep">sales_rep</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={eventsTeam} onChange={(e) => setEventsTeam(e.target.checked)} /> Events team</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={accounting} onChange={(e) => setAccounting(e.target.checked)} /> Accounting</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={impersonation} onChange={(e) => setImpersonation(e.target.checked)} /> Impersonation</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Send welcome email</label>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional context for denial..." />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Send rejection email</label>
        </div>
      )}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="button" onClick={onSubmit} disabled={pending}>
        {pending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}
