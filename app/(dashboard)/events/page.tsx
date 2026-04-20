import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { EventsAdmin } from '@/components/events/events-admin';
import type { Event } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  if ((session.user as { role?: string }).role !== 'admin') redirect('/');

  const supabase = getSupabaseAdmin();
  const { data: events } = await supabase.from('events').select('*').order('event_date', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Events</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage WhiskyFest events, booth pricing, and Shanken signatory lines used in generated contracts.
        </p>
      </div>

      <EventsAdmin initialEvents={(events ?? []) as Event[]} />
    </div>
  );
}
