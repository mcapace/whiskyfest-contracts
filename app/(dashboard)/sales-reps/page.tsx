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
  const [{ data: reps }, { data: assistantRows }] = await Promise.all([
    supabase
      .from('sales_reps')
      .select('*')
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase.from('rep_assistants').select('id, assistant_email, rep_id').order('assistant_email'),
  ]);

  const initialAssistantsByRep: Record<string, { id: string; assistant_email: string; rep_id: string }[]> = {};
  for (const row of assistantRows ?? []) {
    const r = row as { id: string; assistant_email: string; rep_id: string };
    const list = initialAssistantsByRep[r.rep_id] ?? [];
    list.push(r);
    initialAssistantsByRep[r.rep_id] = list;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Sales Reps</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage the reps credited on WhiskyFest and Big Smoke contracts. Add assistants under each rep — same access
          model on both portals. Deactivated reps stay linked on historical contracts but are hidden from new deals.
        </p>
      </div>

      <SalesRepsAdmin
        initialReps={(reps ?? []) as SalesRep[]}
        initialAssistantsByRep={initialAssistantsByRep}
      />
    </div>
  );
}
