import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { EventsAdmin } from '@/components/events/events-admin';
import { isWineSpectatorAdmin } from '@/lib/wine-spectator-access';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');

  const fullAdmin = session.user.role === 'admin';
  const wineAdmin = isWineSpectatorAdmin(session.user);
  if (!fullAdmin && !wineAdmin) redirect('/');

  const wineOnly = !fullAdmin && wineAdmin;

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase.from('events').select('*').order('event_date', { ascending: true });
  const scopedEvents = wineOnly
    ? ((events ?? []) as Event[]).filter((e) => e.product_key === PRODUCT_WINE_SPECTATOR)
    : ((events ?? []) as Event[]);

  const backHref = wineOnly ? '/wine-spectator' : '/';

  return (
    <div className="space-y-8">
      <div>
        <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {wineOnly
            ? 'Manage New York Wine Experience event settings, pricing, and Shanken signatory lines.'
            : 'Manage WhiskyFest events, booth pricing, and Shanken signatory lines used in generated contracts.'}
        </p>
      </div>

      <EventsAdmin initialEvents={scopedEvents} wineSpectatorOnly={wineOnly} />
    </div>
  );
}
