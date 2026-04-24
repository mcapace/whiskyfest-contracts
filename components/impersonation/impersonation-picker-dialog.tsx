'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Cand = { email: string; name: string | null; role_description: string; segment: string };

type Segments = {
  admins: Cand[];
  events_team: Cand[];
  accounting: Cand[];
  sales_reps: Cand[];
  assistants: Cand[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImpersonationPickerDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [q, setQ] = useState('');
  const [segments, setSegments] = useState<Segments | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || segments !== null) return;
    setLoadErr(null);
    let cancelled = false;
    startTransition(async () => {
      const res = await fetch('/api/impersonation/candidates');
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setLoadErr(typeof body.error === 'string' ? body.error : 'Failed to load users');
        return;
      }
      setSegments(body.segments as Segments);
    });
    return () => {
      cancelled = true;
    };
  }, [open, segments]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSegments(null);
      setQ('');
      setLoadErr(null);
    }
    onOpenChange(next);
  }

  const flat = useMemo(() => {
    if (!segments) return [] as Cand[];
    return [
      ...segments.admins.map((c) => ({ ...c, segment: 'Admins' })),
      ...segments.events_team.map((c) => ({ ...c, segment: 'Events team' })),
      ...segments.accounting.map((c) => ({ ...c, segment: 'Accounting' })),
      ...segments.sales_reps.map((c) => ({ ...c, segment: 'Sales reps' })),
      ...segments.assistants.map((c) => ({ ...c, segment: 'Assistants' })),
    ];
  }, [segments]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return flat;
    return flat.filter(
      (c) =>
        c.email.toLowerCase().includes(s) ||
        (c.name?.toLowerCase().includes(s) ?? false) ||
        c.role_description.toLowerCase().includes(s),
    );
  }, [flat, q]);

  async function startAs(email: string) {
    handleOpenChange(false);
    await update({ impersonationTarget: email });
    router.push('/');
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>View as…</DialogTitle>
          <DialogDescription>
            Browse active teammates. Session is read-only: you can explore the app but cannot change data until you exit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
          {pending && !segments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {['Admins', 'Events team', 'Accounting', 'Sales reps', 'Assistants'].map((title) => {
                const rows = filtered.filter((c) => c.segment === title);
                if (rows.length === 0) return null;
                return (
                  <div key={title}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                    <ul className="divide-y rounded-md border border-border/60">
                      {rows.map((c) => (
                        <li key={c.email}>
                          <button
                            type="button"
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/50"
                            onClick={() => void startAs(c.email)}
                          >
                            <span className="font-medium text-foreground">{c.name?.trim() || c.email}</span>
                            <span className="text-xs text-muted-foreground">{c.email}</span>
                            <span className="text-xs leading-snug text-muted-foreground">{c.role_description}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {filtered.length === 0 && segments && (
                <p className="py-6 text-center text-muted-foreground">No users match this search.</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
