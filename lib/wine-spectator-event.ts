import { getSupabaseAdmin } from '@/lib/supabase';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import type { Event } from '@/types/db';

/** All active NYWE events (may be more than one during overlap seasons). */
export async function getActiveWineSpectatorEvents(): Promise<Event[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', PRODUCT_WINE_SPECTATOR)
    .eq('is_active', true)
    .order('event_date', { ascending: true });
  return (data ?? []) as Event[];
}

export async function getActiveWineSpectatorEventIds(): Promise<string[]> {
  const events = await getActiveWineSpectatorEvents();
  return events.map((e) => e.id);
}

export async function getActiveWineSpectatorEvent(): Promise<Event | null> {
  const events = await getActiveWineSpectatorEvents();
  return events[0] ?? null;
}
