'use client';

import { Fragment, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { Plus, Loader2, Check, X, UserMinus, UserCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import type { SalesRep } from '@/types/db';

type AssistantRow = { id: string; assistant_email: string; rep_id: string };

export function SalesRepsAdmin({
  initialReps,
  initialAssistantsByRep,
}: {
  initialReps: SalesRep[];
  initialAssistantsByRep: Record<string, AssistantRow[]>;
}) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [assistantsByRep, setAssistantsByRep] = useState(initialAssistantsByRep);
  const [assistantDraft, setAssistantDraft] = useState<Record<string, string>>({});
  const [assistantErr, setAssistantErr] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setAssistantsByRep(initialAssistantsByRep);
  }, [initialAssistantsByRep]);

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

  async function addAssistant(repId: string) {
    if (readOnly) return;
    const email = (assistantDraft[repId] ?? '').trim().toLowerCase();
    setAssistantErr((m) => ({ ...m, [repId]: null }));
    if (!email.endsWith('@mshanken.com')) {
      setAssistantErr((m) => ({ ...m, [repId]: 'Assistant email must be @mshanken.com' }));
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/sales-reps/${repId}/assistants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_email: email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssistantErr((m) => ({ ...m, [repId]: (j as { error?: string }).error ?? 'Failed to add assistant' }));
        return;
      }
      const row = (j as { assistant: AssistantRow }).assistant;
      setAssistantsByRep((prev) => ({
        ...prev,
        [repId]: [...(prev[repId] ?? []), row].sort((a, b) =>
          a.assistant_email.localeCompare(b.assistant_email),
        ),
      }));
      setAssistantDraft((m) => ({ ...m, [repId]: '' }));
      router.refresh();
    });
  }

  async function removeAssistant(repId: string, assistantEmail: string) {
    if (readOnly) return;
    startTransition(async () => {
      const res = await fetch(`/api/sales-reps/${repId}/assistants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_email: assistantEmail }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setAssistantErr((m) => ({ ...m, [repId]: (j as { error?: string }).error ?? 'Failed to remove' }));
        return;
      }
      setAssistantsByRep((prev) => ({
        ...prev,
        [repId]: (prev[repId] ?? []).filter((a) => a.assistant_email !== assistantEmail),
      }));
      router.refresh();
    });
  }

  const active = initialReps.filter((r) => r.is_active);
  const inactive = initialReps.filter((r) => !r.is_active);

  function renderRepRow(rep: SalesRep) {
    const open = Boolean(expanded[rep.id]);
    const assistants = assistantsByRep[rep.id] ?? [];
    return (
      <Fragment key={rep.id}>
        <tr className="border-b last:border-b-0">
          <td className="px-4 py-3 font-medium">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-left hover:text-foreground"
              onClick={() => setExpanded((m) => ({ ...m, [rep.id]: !open }))}
            >
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {rep.name}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({assistants.length} assistant{assistants.length === 1 ? '' : 's'})
              </span>
            </button>
          </td>
          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{rep.email}</td>
          <td className="px-4 py-3 text-right">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleActive(rep)}
              disabled={busy}
              title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
            >
              {rep.is_active ? (
                <>
                  <UserMinus className="h-4 w-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Reactivate
                </>
              )}
            </Button>
          </td>
        </tr>
        {open ? (
          <tr className="border-b bg-muted/20 last:border-b-0">
            <td colSpan={3} className="px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assistants for {rep.name}
              </p>
              <ul className="mb-3 space-y-1.5">
                {assistants.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No assistants yet.</li>
                ) : (
                  assistants.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-xs">{a.assistant_email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                        onClick={() => removeAssistant(rep.id, a.assistant_email)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor={`asst-${rep.id}`}>Add assistant email</Label>
                  <Input
                    id={`asst-${rep.id}`}
                    type="email"
                    value={assistantDraft[rep.id] ?? ''}
                    onChange={(e) => setAssistantDraft((m) => ({ ...m, [rep.id]: e.target.value }))}
                    placeholder="assistant@mshanken.com"
                    disabled={busy}
                  />
                </div>
                <Button
                  size="sm"
                  disabled={busy}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  onClick={() => addAssistant(rep.id)}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add assistant
                </Button>
              </div>
              {assistantErr[rep.id] ? (
                <p className="mt-2 text-sm text-destructive">{assistantErr[rep.id]}</p>
              ) : null}
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  }

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
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAdd(false);
                  setErr(null);
                }}
                disabled={pending}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Sales reps and assistants get WhiskyFest and Big Smoke pipeline access. Expand a rep to manage assistants.
        </p>
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
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    No active reps
                  </td>
                </tr>
              ) : (
                active.map((rep) => renderRepRow(rep))
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
              <tbody>{inactive.map((rep) => renderRepRow(rep))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
