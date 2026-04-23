import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { roleDescriptionForUser } from '@/lib/effective-user';

export const dynamic = 'force-dynamic';

type Cand = { email: string; name: string | null; role_description: string; segment: string };

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !session.user.can_impersonate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const login = session.user.email.toLowerCase();
  const supabase = getSupabaseAdmin();

  const { data: users } = await supabase
    .from('app_users')
    .select('email, name, role, is_active, is_events_team, is_accounting, can_impersonate')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const { data: repRows } = await supabase.from('sales_reps').select('email').eq('is_active', true);
  const repEmails = new Set((repRows ?? []).map((r) => (r as { email: string }).email.toLowerCase()));

  const { data: asstRows } = await supabase.from('rep_assistants').select('assistant_email');
  const asstEmails = new Set(
    (asstRows ?? []).map((r) => (r as { assistant_email: string }).assistant_email.toLowerCase()),
  );

  const segments: Record<string, Cand[]> = {
    admins: [],
    events_team: [],
    accounting: [],
    sales_reps: [],
    assistants: [],
  };
  const used = new Set<string>();

  function describe(
    email: string,
    u: { role: string; is_events_team?: boolean | null; is_accounting?: boolean | null },
  ): string {
    const isRep = repEmails.has(email);
    const isAsst = asstEmails.has(email);
    const assistantOnly = isAsst && !isRep;
    return roleDescriptionForUser({
      role: u.role,
      is_events_team: Boolean(u.is_events_team),
      is_accounting: Boolean(u.is_accounting),
      is_sales_rep: isRep,
      is_assistant_only: assistantOnly,
    });
  }

  const rows = (users ?? []) as Array<{
    email: string;
    name: string | null;
    role: string;
    is_events_team?: boolean;
    is_accounting?: boolean;
  }>;

  for (const u of rows) {
    const e = u.email.toLowerCase();
    if (e === login) continue;
    if (u.role === 'admin') {
      segments.admins.push({
        email: u.email,
        name: u.name,
        role_description: describe(e, u),
        segment: 'Admins',
      });
      used.add(e);
    }
  }
  for (const u of rows) {
    const e = u.email.toLowerCase();
    if (e === login || used.has(e)) continue;
    if (u.is_events_team) {
      segments.events_team.push({
        email: u.email,
        name: u.name,
        role_description: describe(e, u),
        segment: 'Events team',
      });
      used.add(e);
    }
  }
  for (const u of rows) {
    const e = u.email.toLowerCase();
    if (e === login || used.has(e)) continue;
    if (u.is_accounting) {
      segments.accounting.push({
        email: u.email,
        name: u.name,
        role_description: describe(e, u),
        segment: 'Accounting',
      });
      used.add(e);
    }
  }
  for (const u of rows) {
    const e = u.email.toLowerCase();
    if (e === login || used.has(e)) continue;
    if (repEmails.has(e)) {
      segments.sales_reps.push({
        email: u.email,
        name: u.name,
        role_description: describe(e, u),
        segment: 'Sales reps',
      });
      used.add(e);
    }
  }
  for (const u of rows) {
    const e = u.email.toLowerCase();
    if (e === login || used.has(e)) continue;
    if (asstEmails.has(e)) {
      segments.assistants.push({
        email: u.email,
        name: u.name,
        role_description: describe(e, u),
        segment: 'Assistants',
      });
    }
  }

  return NextResponse.json({ segments });
}
