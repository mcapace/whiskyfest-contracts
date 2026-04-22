'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { AddressAutocomplete } from '@/components/forms/address-autocomplete';
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
  initialAddressLine1: string | null;
  initialAddressLine2: string | null;
  initialCity: string | null;
  initialState: string | null;
  initialZip: string | null;
  initialCountry: string | null;
}

export function SignerContactEdit({
  contractId,
  initialName,
  initialTitle,
  initialEmail,
  initialAddressLine1,
  initialAddressLine2,
  initialCity,
  initialState,
  initialZip,
  initialCountry,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName ?? '');
  const [title, setTitle] = useState(initialTitle ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [address, setAddress] = useState({
    exhibitor_address_line1: initialAddressLine1 ?? '',
    exhibitor_address_line2: initialAddressLine2 ?? '',
    exhibitor_city: initialCity ?? '',
    exhibitor_state: initialState ?? '',
    exhibitor_zip: initialZip ?? '',
    exhibitor_country: initialCountry ?? 'United States',
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFromProps() {
    setName(initialName ?? '');
    setTitle(initialTitle ?? '');
    setEmail(initialEmail ?? '');
    setAddress({
      exhibitor_address_line1: initialAddressLine1 ?? '',
      exhibitor_address_line2: initialAddressLine2 ?? '',
      exhibitor_city: initialCity ?? '',
      exhibitor_state: initialState ?? '',
      exhibitor_zip: initialZip ?? '',
      exhibitor_country: initialCountry ?? 'United States',
    });
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
          exhibitor_address_line1: address.exhibitor_address_line1.trim(),
          exhibitor_address_line2: address.exhibitor_address_line2.trim() || null,
          exhibitor_city: address.exhibitor_city.trim(),
          exhibitor_state: address.exhibitor_state.trim(),
          exhibitor_zip: address.exhibitor_zip.trim(),
          exhibitor_country: address.exhibitor_country.trim(),
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit signer and exhibitor address</DialogTitle>
          <DialogDescription>
            Update the DocuSign recipient and mailing address before sending.
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
            <Label htmlFor="s-email">Email</Label>
            <Input
              id="s-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium">Mailing address</p>
            <AddressAutocomplete
              value={address}
              onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))}
            />
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
          <Button
            onClick={save}
            disabled={
              pending ||
              !name.trim() ||
              !email.trim() ||
              !address.exhibitor_address_line1.trim() ||
              !address.exhibitor_city.trim() ||
              !address.exhibitor_state.trim() ||
              !address.exhibitor_zip.trim() ||
              !address.exhibitor_country.trim()
            }
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
