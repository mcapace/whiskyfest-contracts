'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { formatLastLoginRelative, lastLoginFullTooltip } from '@/lib/last-login-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppUser, UserRole } from '@/types/db';

interface Props {
  initialUsers: AppUser[];
  currentEmail: string;
}

type LastLoginSort = 'default' | 'asc' | 'desc';

function compareByLastLogin(a: AppUser, b: AppUser, dir: 'asc' | 'desc'): number {
  const ta = a.last_login_at ? new Date(a.last_login_at).getTime() : Number.POSITIVE_INFINITY;
  const tb = b.last_login_at ? new Date(b.last_login_at).getTime() : Number.POSITIVE_INFINITY;
  if (ta === Number.POSITIVE_INFINITY && tb === Number.POSITIVE_INFINITY) return 0;
  if (ta === Number.POSITIVE_INFINITY) return 1;
  if (tb === Number.POSITIVE_INFINITY) return -1;
  return dir === 'asc' ? ta - tb : tb - ta;
}

export function UsersAdmin({ initialUsers, currentEmail }: Props) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [lastLoginSort, setLastLoginSort] = useState<LastLoginSort>('default');
  const [neverLoggedOnly, setNeverLoggedOnly] = useState(false);
  const [bubblePending, setBubblePending] = useState(false);
  const [bubbleMsg, setBubbleMsg] = useState<string | null>(null);

  const displayedUsers = useMemo(() => {
    const base = neverLoggedOnly ? initialUsers.filter((u) => !u.last_login_at) : [...initialUsers];
    if (lastLoginSort === 'default') {
      base.sort((a, b) => a.email.localeCompare(b.email));
      return base;
    }
    base.sort((a, b) => compareByLastLogin(a, b, lastLoginSort));
    return base;
  }, [initialUsers, lastLoginSort, neverLoggedOnly]);

  function cycleLastLoginSort() {
    setLastLoginSort((s) => (s === 'default' ? 'desc' : s === 'desc' ? 'asc' : 'default'));
  }

  function updateRole(email: string, role: UserRole) {
    if (readOnly) return;
    setErr(null);
    setPendingEmail(email);
    startTransition(async () => {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      setPendingEmail(null);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Update failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function publishDailyBubble() {
    if (readOnly) return;
    setBubbleMsg(null);
    setBubblePending(true);
    void (async () => {
      const res = await fetch('/api/admin/daily-bubble/publish', { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      setBubblePending(false);
      if (!res.ok) {
        setBubbleMsg(j.error ?? `Publish failed (${res.status}). Check ANTHROPIC_API_KEY and migration 028.`);
        return;
      }
      if (j.status === 'already_generated') {
        setBubbleMsg('Today’s bubble already exists. Go to the dashboard (refresh if needed).');
      } else {
        setBubbleMsg('Published. Open or refresh the dashboard to see the banner.');
      }
      router.refresh();
    })();
  }

  function toggleActive(user: AppUser, is_active: boolean) {
    if (readOnly) return;
    setErr(null);
    setPendingEmail(user.email);
    startTransition(async () => {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, role: user.role, is_active }),
      });
      setPendingEmail(null);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Update failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team access</CardTitle>
        <CardDescription>
          Roles: <span className="font-medium text-foreground">Admin</span> (this page + events),{' '}
          <span className="font-medium text-foreground">Sales</span> (contracts),{' '}
          <span className="font-medium text-foreground">Viewer</span> (read-only — not enforced in Phase 1 UI yet).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {err && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            checked={neverLoggedOnly}
            onChange={(e) => setNeverLoggedOnly(e.target.checked)}
          />
          Show only users who have never logged in
        </label>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={cycleLastLoginSort}
                    className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                    title="Sort by last login (newest first, oldest first, then default)"
                  >
                    Last Login
                    {lastLoginSort === 'desc' ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    ) : lastLoginSort === 'asc' ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {displayedUsers.map((u) => {
                const rowPending = pending && pendingEmail === u.email;
                const isSelf = u.email.toLowerCase() === currentEmail.toLowerCase();
                const rowDisabled = rowPending || readOnly;
                const rel = formatLastLoginRelative(u.last_login_at ?? null);
                const tip = lastLoginFullTooltip(u.last_login_at ?? null);
                return (
                  <tr key={u.email}>
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.name ?? '—'}</td>
                    <td
                      className={`px-4 py-3 tabular-nums ${u.last_login_at ? 'text-foreground' : 'text-muted-foreground'}`}
                      title={tip}
                    >
                      {rel}
                    </td>
                    <td className="px-4 py-3">
                      <span title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined} className="inline-block">
                        <Select
                          value={u.role}
                          onValueChange={(v) => updateRole(u.email, v as UserRole)}
                          disabled={rowDisabled}
                        >
                          <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="sales">sales</SelectItem>
                            <SelectItem value="viewer">viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant={u.is_active ? 'outline' : 'secondary'}
                        size="sm"
                        disabled={rowDisabled || (isSelf && u.is_active)}
                        onClick={() => toggleActive(u, !u.is_active)}
                        title={
                          readOnly
                            ? IMPERSONATION_BUTTON_TOOLTIP
                            : isSelf && u.is_active
                              ? 'You cannot deactivate yourself'
                              : undefined
                        }
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm">
          <p className="font-medium text-foreground">Did You Know — daily bubble</p>
          <p className="mt-1 text-muted-foreground">
            Apply migrations <span className="font-mono text-xs">028_daily_bubbles</span> and{' '}
            <span className="font-mono text-xs">029_daily_bubble_fetch_fn</span>. Until the AI row exists, everyone
            still sees a curated &quot;Did You Know&quot;; cron runs at 12:00 UTC or publish below.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={readOnly || bubblePending}
            title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
            onClick={publishDailyBubble}
          >
            {bubblePending ? 'Publishing…' : 'Publish today’s bubble (AI)'}
          </Button>
          {bubbleMsg ? <p className="mt-2 text-muted-foreground">{bubbleMsg}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
