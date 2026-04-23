import type { Session } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessibleSalesRepIds } from '@/lib/rep-access';

/** Extra session fields set in `callbacks.session` (see `types/next-auth.d.ts`). */
export type ImpersonationSessionSlice = {
  impersonation?: {
    active: boolean;
    target_email: string;
    target_name: string | null;
    started_at: string;
    role_description: string;
  } | null;
  is_read_only_impersonation?: boolean;
};

export type WhiskyFestSession = Session &
  ImpersonationSessionSlice & {
    user: Session['user'] & {
      can_impersonate?: boolean;
    };
  };

/** Email used for data scoping (rep assistants, accounting, etc.). */
export function getEffectiveUserEmail(session: Session | null): string | null {
  if (!session?.user?.email) return null;
  const s = session as WhiskyFestSession;
  if (s.impersonation?.active && s.impersonation.target_email) {
    return s.impersonation.target_email.toLowerCase();
  }
  return session.user.email.toLowerCase();
}

/** Google / login email — never the impersonated address. */
export function getLoginUserEmail(session: Session | null): string | null {
  return session?.user?.email?.toLowerCase() ?? null;
}

export function isReadOnlyImpersonation(session: Session | null): boolean {
  return Boolean((session as WhiskyFestSession).is_read_only_impersonation);
}

export function roleDescriptionForUser(row: {
  role: string;
  is_events_team?: boolean | null;
  is_accounting?: boolean | null;
  is_sales_rep?: boolean;
  is_assistant_only?: boolean;
}): string {
  if (row.is_assistant_only) return 'Assistant (rep access)';
  if (row.is_accounting) return 'Accounting';
  if (row.role === 'admin') return 'Admin';
  if (row.is_events_team) return 'Events team';
  if (row.is_sales_rep) return 'Sales rep';
  if (row.role === 'viewer') return 'Viewer';
  return row.role;
}

/** Display strings for the impersonation banner (effective identity). */
export async function loadImpersonationTargetDisplay(email: string): Promise<{
  name: string | null;
  role_description: string;
}> {
  const supabase = getSupabaseAdmin();
  const e = email.toLowerCase();
  const { data: au } = await supabase
    .from('app_users')
    .select('name, role, is_events_team, is_accounting')
    .eq('email', e)
    .maybeSingle();

  const { data: sr } = await supabase.from('sales_reps').select('id').eq('email', e).eq('is_active', true).maybeSingle();
  const repIds = await getAccessibleSalesRepIds(e, supabase);
  const isSalesRepActive = Boolean(sr?.id);
  const { count: asstCount } = await supabase
    .from('rep_assistants')
    .select('*', { count: 'exact', head: true })
    .eq('assistant_email', e);
  const assistantOnly = (asstCount ?? 0) > 0 && !isSalesRepActive;

  const role = (au?.role as string) ?? 'viewer';
  const desc = roleDescriptionForUser({
    role,
    is_events_team: Boolean(au?.is_events_team),
    is_accounting: Boolean(au?.is_accounting),
    is_sales_rep: isSalesRepActive || repIds.length > 0,
    is_assistant_only: assistantOnly,
  });

  return { name: au?.name ?? null, role_description: desc };
}
