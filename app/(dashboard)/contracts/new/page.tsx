import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function NewContractPage() {
  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  return <NewContractForm events={(events ?? []) as Event[]} />;
}
