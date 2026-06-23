'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
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
  initialName: string | null;
  initialTitle: string | null;
  initialEmail: string | null;
  initialCcName?: string | null;
  initialCcEmail?: string | null;
}

export function SignerContactEdit({
  contractId,
  initialName,
  initialTitle,
  initialEmail,
  initialCcName,
  initialCcEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [ccName, setCcName] = useState(initialCcName ?? '');
  const [ccEmail, setCcEmail] = useState(initialCcEmail ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFromProps() {
    setName(initialName ?? '');
    setTitle(initialTitle ?? '');
    setEmail(initialEmail ?? '');
    setCcName(initialCcName ?? '');
    setCcEmail(initialCcEmail ?? '');
  }

  async function save() {
    setErr(null);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_1_name: name.trim(),
          signer_1_title: title.trim() || null,
          signer_1_email: email.trim(),
          signer_cc_name: ccName.trim() || null,
          signer_cc_email: ccEmail.trim() || null,
        }),
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
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setErr(null);
          resetFromProps();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          Edit exhibitor signer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit exhibitor signer</DialogTitle>
          <DialogDescription>
            Update the DocuSign recipient and optional CC before sending. Mailing address, telephone, billing, and event
            contact are collected from the exhibitor at signing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Title</Label>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-email">Signer email</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">DocuSign CC (optional)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assistant or colleague copied on DocuSign notifications. They do not sign.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-cc-name">CC name</Label>
              <Input id="s-cc-name" value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="Assistant name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-cc-email">CC email</Label>
              <Input
                id="s-cc-email"
                type="email"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="assistant@company.com"
              />
            </div>
          </div>
        </div>
        {err && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Close
          </Button>
          <Button onClick={save} disabled={pending || !name.trim() || !email.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
