'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea, Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Props {
  contractId: string;
  exhibitorName: string;
}

export function CancelContractDialog({ contractId, exhibitorName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleConfirm() {
    if (reason.trim().length < 3) {
      setErr('Please provide a reason (at least 3 characters)');
      return;
    }
    setErr(null);

    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/cancel`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim() }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Request failed (${res.status})`);
        return;
      }

      setOpen(false);
      router.refresh();
      queueMicrotask(() => router.refresh());
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setReason(''); setErr(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <XCircle className="h-4 w-4" />
          Cancel Contract
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this contract?</DialogTitle>
          <DialogDescription>
            This will mark <strong className="text-foreground">{exhibitorName}</strong> as cancelled.
            Cancelled contracts can't be reactivated — you'd need to create a new one if the deal comes back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason for cancellation</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Deal fell through, pricing renegotiation, duplicate contract, etc."
            rows={3}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            This reason is logged permanently in the contract&apos;s audit trail.
          </p>
        </div>

        {err && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep contract
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
