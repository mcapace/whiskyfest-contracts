import type { SupabaseClient } from '@supabase/supabase-js';

/** Own sales_reps row id if any; union with reps this user assists (unique). */
export async function getAccessibleSalesRepIds(email: string, supabase: SupabaseClient): Promise<string[]> {
  const e = email.toLowerCase();
  const ids = new Set<string>();

  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, is_active, is_events_team, is_accounting, can_view_all_sales, is_big_smoke_admin')
    .eq('email', e)
    .maybeSingle();

  const canViewAll =
    Boolean(appUser?.is_active) &&
    (appUser?.role === 'admin' ||
      Boolean(appUser?.is_events_team) ||
      Boolean(appUser?.is_accounting) ||
      Boolean(appUser?.is_big_smoke_admin) ||
      Boolean(appUser?.can_view_all_sales));

  if (canViewAll) {
    const { data: allReps } = await supabase.from('sales_reps').select('id').eq('is_active', true);
    for (const row of allReps ?? []) {
      if (row.id) ids.add(row.id as string);
    }
    return [...ids];
  }

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
