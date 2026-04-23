'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { Plus, Loader2, Check, X, UserMinus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import type { SalesRep } from '@/types/db';

export function SalesRepsAdmin({ initialReps }: { initialReps: SalesRep[] }) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd() {
    if (readOnly) return;
    setErr(null);
    if (newName.trim().length < 2 || !newEmail.trim().toLowerCase().endsWith('@mshanken.com')) {
      setErr('Name must be 2+ chars and email must be @mshanken.com');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/sales-reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? 'Failed to add rep');
        return;
      }
      setNewName('');
      setNewEmail('');
      setShowAdd(false);
      router.refresh();
    });
  }

  async function toggleActive(rep: SalesRep) {
    if (readOnly) return;
    startTransition(async () => {
      const res = await fetch(`/api/sales-reps/${rep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rep.is_active }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Failed: ${j.error ?? res.status}`);
        return;
      }
      router.refresh();
    });
  }

  const active = initialReps.filter((r) => r.is_active);
  const inactive = initialReps.filter((r) => !r.is_active);

  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-card p-4">
        {!showAdd ? (
          <Button
            variant="outline"
            onClick={() => {
              setShowAdd(true);
              setErr(null);
            }}
            disabled={readOnly}
            title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
          >
            <Plus className="h-4 w-4" />
            Add sales rep
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="new_name">Name</Label>
                <Input
                  id="new_name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="First Last"
                  autoFocus
                  disabled={busy}
                />
              </div>
              <div>
                <Label htmlFor="new_email">Email</Label>
                <Input
                  id="new_email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="flast@mshanken.com"
                  type="email"
                  disabled={busy}
                />
              </div>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} disabled={busy} title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Check className="h-4 w-4" />
                Save
              </Button>
              <Button variant="ghost" onClick={() => { setShowAdd(false); setErr(null); }} disabled={pending}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Active ({active.length})</h2>
        <div className="rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No active reps</td>
                </tr>
              ) : (
                active.map((rep) => (
                  <tr key={rep.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{rep.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rep.email}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(rep)}
                        disabled={busy}
                        title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                      >
                        <UserMinus className="h-4 w-4" />
                        Deactivate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Inactive ({inactive.length})</h2>
          <div className="rounded-md border bg-card opacity-75">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {inactive.map((rep) => (
                  <tr key={rep.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{rep.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rep.email}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(rep)}
                        disabled={busy}
                        title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                      >
                        <UserCheck className="h-4 w-4" />
                        Reactivate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
