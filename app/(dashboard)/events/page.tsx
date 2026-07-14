import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { EventsAdmin } from '@/components/events/events-admin';
import { isBigSmokeAdmin } from '@/lib/big-smoke-access';
import { isWineSpectatorAdmin } from '@/lib/wine-spectator-access';
import { PRODUCT_BIG_SMOKE, PRODUCT_WHISKYFEST, PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import { portalKindFromHost } from '@/lib/portal-host';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');

  const portalKind = portalKindFromHost(headers().get('host'));
  const nywePortal = portalKind === 'nywe';
  const bigSmokePortal = portalKind === 'big_smoke';
  const productKey = nywePortal
    ? PRODUCT_WINE_SPECTATOR
    : bigSmokePortal
      ? PRODUCT_BIG_SMOKE
      : PRODUCT_WHISKYFEST;

  const fullAdmin = session.user.role === 'admin';
  const wineAdmin = isWineSpectatorAdmin(session.user);
  const bigSmokeAdmin = isBigSmokeAdmin(session.user);
  const eventsTeam = Boolean(session.user.is_events_team);

  if (nywePortal) {
    if (!fullAdmin && !wineAdmin) redirect('/');
  } else if (bigSmokePortal) {
    // Admins, Big Smoke admins, and events team can manage / add Big Smoke events.
    if (!fullAdmin && !bigSmokeAdmin && !eventsTeam) redirect('/');
  } else if (!fullAdmin) {
    redirect('/');
  }

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase.from('events').select('*').order('event_date', { ascending: true });
  const scopedEvents = ((events ?? []) as Event[]).filter((e) => e.product_key === productKey);

  const backHref = '/';

  return (
    <div className="space-y-8">
      <div>
        <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {nywePortal
            ? 'Manage New York Wine Experience event settings, pricing, and Shanken signatory lines.'
            : bigSmokePortal
              ? 'Manage Big Smoke events (Las Vegas and future city editions), package pricing, templates, and signatory lines.'
              : 'Manage WhiskyFest events, booth pricing, and Shanken signatory lines used in generated contracts.'}
        </p>
      </div>

      <EventsAdmin
        initialEvents={scopedEvents}
        wineSpectatorOnly={nywePortal}
        bigSmokePortal={bigSmokePortal}
      />
    </div>
  );
}
