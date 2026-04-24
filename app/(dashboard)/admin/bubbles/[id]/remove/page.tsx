import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { BubbleRemoveConfirm } from '@/components/daily-bubble/bubble-remove-confirm';

export const dynamic = 'force-dynamic';

export default async function RemoveBubblePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string };
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(`/admin/bubbles/${params.id}/remove?token=${searchParams.token ?? ''}`)}`);
  }

  const supabase0 = getSupabaseAdmin();
  const adminEmail = session.user.email!.toLowerCase();
  const { data: adminRow } = await supabase0.from('app_users').select('role, is_active').eq('email', adminEmail).maybeSingle();
  if (!adminRow?.is_active || adminRow.role !== 'admin') {
    redirect('/');
  }

  const token = searchParams.token?.trim();
  if (!token) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <p className="text-sm text-muted-foreground">This link is missing a token. Open the link from your notification email.</p>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const { data: row, error } = await supabase0.from('daily_bubbles').select('*').eq('id', params.id).maybeSingle();

  if (error || !row) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <p className="text-sm text-destructive">Bubble not found.</p>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const now = new Date().toISOString();
  if (row.removed_at) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <p className="text-sm text-muted-foreground">This bubble was already removed.</p>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (row.remove_token !== token) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <p className="text-sm text-destructive">Invalid link.</p>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!row.remove_token_expires_at || row.remove_token_expires_at < now) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12">
        <p className="text-sm text-destructive">This link has expired (24 hours). Remove the bubble from the dashboard if it is still visible.</p>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Remove today&apos;s bubble?</h1>
      <p className="text-sm text-muted-foreground">This hides the banner for everyone until the next scheduled bubble.</p>
      <blockquote className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed">
        {row.content}
        {row.attribution ? <footer className="mt-2 text-muted-foreground italic">— {row.attribution}</footer> : null}
      </blockquote>
      <BubbleRemoveConfirm bubbleId={params.id} token={token} />
    </div>
  );
}
