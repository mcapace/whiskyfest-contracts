'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AppUser, UserRole } from '@/types/db';

interface Props {
  initialUsers: AppUser[];
  currentEmail: string;
}

export function UsersAdmin({ initialUsers, currentEmail }: Props) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

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
        <div className="overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {initialUsers.map(u => {
                const rowPending = pending && pendingEmail === u.email;
                const isSelf = u.email.toLowerCase() === currentEmail.toLowerCase();
                const rowDisabled = rowPending || readOnly;
                return (
                  <tr key={u.email}>
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined} className="inline-block">
                        <Select
                          value={u.role}
                          onValueChange={v => updateRole(u.email, v as UserRole)}
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
      </CardContent>
    </Card>
  );
}
