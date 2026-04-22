'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Undo2, Loader2 } from 'lucide-react';
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

export function RecallDocusignDialog({ contractId, exhibitorName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [voidedReason, setVoidedReason] = useState(
    'Recalled from WhiskyFest to update recipient details and resend.',
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleConfirm() {
    const reason = voidedReason.trim();
    if (reason.length < 3) {
      setErr('Please enter a short reason (at least 3 characters) for DocuSign.');
      return;
    }
    setErr(null);

    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/recall-docusign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidedReason: reason }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Request failed (${res.status})`);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setErr(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-600/40 text-amber-950 hover:bg-amber-50">
          <Undo2 className="h-4 w-4" />
          Recall DocuSign contract
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recall contract and unlock for edit?</DialogTitle>
          <DialogDescription>
            This recalls the DocuSign contract for <strong className="text-foreground">{exhibitorName}</strong> and
            sets the contract back to <strong className="text-foreground">Approved</strong>. You can fix the exhibitor
            email (or other details), then use <strong className="text-foreground">Send via DocuSign</strong> again.
            DocuSign emails recipients that the contract was voided.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="voidReason">Reason shown in DocuSign (required)</Label>
          <Textarea
            id="voidReason"
            value={voidedReason}
            onChange={(e) => setVoidedReason(e.target.value)}
            rows={3}
          />
        </div>

        {err && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Recall contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
