import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { AccessRequestReviewForm } from '@/components/admin/access-request-review-form';
import type { AccessRequest } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function AccessRequestReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';
  const action = typeof searchParams?.action === 'string' ? searchParams.action : '';

  const session = await auth();
  if (!session?.user?.email) {
    const callback = encodeURIComponent(`/admin/access-requests/${params.id}?token=${token}&action=${action}`);
    redirect(`/auth/login?callbackUrl=${callback}`);
  }

  const email = getEffectiveUserEmail(session);
  const supabase = getSupabaseAdmin();
  const { data: adminUser } = await supabase.from('app_users').select('role, is_active').eq('email', email!).maybeSingle();
  if (!adminUser?.is_active || adminUser.role !== 'admin') {
    return <div className="py-10 text-sm text-destructive">403 — Admin access required.</div>;
  }

  const { data: request } = await supabase.from('access_requests').select('*').eq('id', params.id).maybeSingle<AccessRequest>();
  if (!request || request.status !== 'pending' || !token || request.approval_token !== token || new Date(request.token_expires_at).getTime() <= Date.now()) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <h1 className="wf-display-serif text-3xl">This approval link is no longer valid</h1>
        <p className="mt-3 text-sm text-muted-foreground">Please return to the Access Requests list to continue review.</p>
        <Link href="/admin/access-requests" className="mt-5 inline-block text-sm text-accent-brand underline underline-offset-2">
          Go to Access Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="wf-display-serif text-3xl">Review access request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {request.name || 'Unknown'} ({request.email}) · Requested {new Date(request.requested_at).toLocaleString('en-US')}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-5">
        <AccessRequestReviewForm
          requestId={request.id}
          token={token}
          defaultAction={action === 'deny' ? 'deny' : 'approve'}
        />
      </div>
    </div>
  );
}
