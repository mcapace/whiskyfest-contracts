import { getSupabaseAdmin } from '@/lib/supabase';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import type { Event } from '@/types/db';

export async function getActiveWineSpectatorEvent(): Promise<Event | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', PRODUCT_WINE_SPECTATOR)
    .eq('is_active', true)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle<Event>();
  return data ?? null;
}
