import type { SupabaseClient } from '@supabase/supabase-js';

/** Own sales_reps row id if any; union with reps this user assists (unique). */
export async function getAccessibleSalesRepIds(email: string, supabase: SupabaseClient): Promise<string[]> {
  const e = email.toLowerCase();
  const ids = new Set<string>();

  const { data: own } = await supabase
    .from('sales_reps')
    .select('id')
    .eq('email', e)
    .eq('is_active', true)
    .maybeSingle();

  if (own?.id) ids.add(own.id);

  const { data: assisted } = await supabase.from('rep_assistants').select('rep_id').eq('assistant_email', e);

  for (const row of assisted ?? []) {
    const id = (row as { rep_id: string }).rep_id;
    if (id) ids.add(id);
  }

  return [...ids];
}
