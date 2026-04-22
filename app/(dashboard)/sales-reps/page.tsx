import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SalesRepsAdmin } from '@/components/sales-reps/sales-reps-admin';
import type { SalesRep } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function SalesRepsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  if ((session.user as { role?: string }).role !== 'admin') redirect('/');

  const supabase = getSupabaseAdmin();
  const { data: reps } = await supabase
    .from('sales_reps')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Sales Reps</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage the reps credited on contracts. Deactivated reps remain linked on historical contracts but
          are hidden from new-contract selection.
        </p>
      </div>

      <SalesRepsAdmin initialReps={(reps ?? []) as SalesRep[]} />
    </div>
  );
}
