import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { ImportContractForm } from '@/components/contracts/import-contract-form';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function ImportContractPage() {
  const actor = await requireContractActorForPage();
  if (!actor.isAdmin && !actor.isEventsTeam) {
    redirect('/contracts');
  }

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  return (
    <ImportContractForm
      events={(events ?? []) as Event[]}
      currentUserEmail={actor.email}
      isAdmin={actor.isAdmin}
    />
  );
}
