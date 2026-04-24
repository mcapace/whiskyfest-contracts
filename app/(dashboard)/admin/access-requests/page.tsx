import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { Badge } from '@/components/ui/badge';
import type { AccessRequest, AccessRequestStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

const tabs: Array<{ key: 'pending' | 'approved' | 'rejected' | 'all'; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  const email = getEffectiveUserEmail(session);
  const supabase = getSupabaseAdmin();
  const { data: adminUser } = await supabase.from('app_users').select('role, is_active').eq('email', email!).maybeSingle();
  if (!adminUser?.is_active || adminUser.role !== 'admin') {
    return <div className="py-10 text-sm text-destructive">403 — Admin access required.</div>;
  }

  const statusFilter =
    typeof searchParams?.status === 'string' && ['pending', 'approved', 'rejected', 'all'].includes(searchParams.status)
      ? (searchParams.status as 'pending' | 'approved' | 'rejected' | 'all')
      : 'pending';
  const done = typeof searchParams?.done === 'string' ? searchParams.done : '';

  let q = supabase.from('access_requests').select('*').order('requested_at', { ascending: false });
  if (statusFilter !== 'all') q = q.eq('status', statusFilter);
  const { data } = await q;
  const rows = (data ?? []) as AccessRequest[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="wf-display-serif text-3xl">Access Requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review pending sign-in requests and grant appropriate access.</p>
        {done ? (
          <p className="mt-3 rounded-md border border-emerald-400/40 bg-emerald-100/40 px-3 py-2 text-sm text-emerald-900">
            Access request {done === 'approved' ? 'approved' : 'rejected'} successfully.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === 'pending' ? '/admin/access-requests' : `/admin/access-requests?status=${t.key}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${statusFilter === t.key ? 'bg-fest-50 border-fest-700 text-fest-900' : 'bg-background border-border hover:bg-muted/50'}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Requested</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reviewed by</th>
              <th className="px-3 py-2">Reviewed at</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                <td className="px-3 py-2">{r.name ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(r.requested_at).toLocaleString('en-US')}</td>
                <td className="px-3 py-2">
                  <Badge className={statusBadge(r.status)}>{r.status}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.reviewed_by ?? '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-US') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {r.status === 'pending' ? (
                    <Link href={`/admin/access-requests/${r.id}?token=${encodeURIComponent(r.approval_token)}&action=approve`} className="text-accent-brand underline underline-offset-2">
                      Review
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>
                  No access requests found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusBadge(status: AccessRequestStatus): string {
  if (status === 'approved') return 'border-emerald-700/40 bg-emerald-100/40 text-emerald-900';
  if (status === 'rejected') return 'border-red-700/40 bg-red-100/40 text-red-900';
  return 'border-amber-700/40 bg-amber-100/40 text-amber-900';
}
