'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Eye, Loader2, Search } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
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

export function ImpersonationMenu({ canImpersonate }: { canImpersonate: boolean }) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [segments, setSegments] = useState<Segments | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const readOnly = Boolean(session?.is_read_only_impersonation);

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

  function loadCandidates() {
    setLoadErr(null);
    startTransition(async () => {
      const res = await fetch('/api/impersonation/candidates');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadErr(typeof body.error === 'string' ? body.error : 'Failed to load users');
        return;
      }
      setSegments(body.segments as Segments);
    });
  }

  async function startAs(email: string) {
    setOpen(false);
    await update({ impersonationTarget: email });
    router.push('/');
    router.refresh();
  }

  async function exit() {
    await update({ impersonationClear: true });
    router.refresh();
  }

  if (!canImpersonate) return null;

  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          setOpen(true);
          setQ('');
          if (!segments) loadCandidates();
        }}
      >
        <Eye className="mr-2 h-4 w-4" />
        View as…
      </DropdownMenuItem>
      {readOnly ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void exit();
            }}
          >
            Exit impersonation
          </DropdownMenuItem>
        </>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
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
                              <span className="text-xs text-fest-800/90">{c.role_description}</span>
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
    </>
  );
}
