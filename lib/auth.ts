import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessibleSalesRepIds } from '@/lib/rep-access';
import { loadImpersonationTargetDisplay } from '@/lib/effective-user';
import { logImpersonationEnded, logImpersonationStarted } from '@/lib/impersonation-audit';
import { ensureAccessRequestForUnknownUser } from '@/lib/access-requests';
import type { UserRole } from '@/types/db';

const IMPERSONATION_TTL_MS = 30 * 60 * 1000;

async function computeAccessFlagsForEmail(
  email: string,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<{
  role: string;
  is_events_team: boolean;
  is_accounting: boolean;
  pipeline_access: boolean;
}> {
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, is_active, is_events_team, is_accounting')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!appUser?.is_active) {
    return { role: 'viewer', is_events_team: false, is_accounting: false, pipeline_access: false };
  }

  const accessibleSalesRepIds = await getAccessibleSalesRepIds(email, supabase);
  const isAdmin = appUser.role === 'admin';
  const isEventsTeam = Boolean((appUser as { is_events_team?: boolean }).is_events_team);
  const isAccounting = Boolean((appUser as { is_accounting?: boolean }).is_accounting);
  const hasRep = accessibleSalesRepIds.length > 0;

  return {
    role: appUser.role,
    is_events_team: isEventsTeam,
    is_accounting: isAccounting,
    pipeline_access: isAdmin || isEventsTeam || hasRep,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
          hd: 'mshanken.com',
        },
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (!email.endsWith('@mshanken.com')) return false;

      const supabase = getSupabaseAdmin();
      const { data: appUser } = await supabase
        .from('app_users')
        .select('email, is_active, role')
        .eq('email', email)
        .maybeSingle();

      if (!appUser) {
        await ensureAccessRequestForUnknownUser({ email, name: user.name });
        return `/access-pending?email=${encodeURIComponent(email)}`;
      }

      if (!appUser.is_active) return '/auth/login?error=account_deactivated';

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      const supabase = getSupabaseAdmin();
      const loginEmail = (
        (user?.email as string | undefined)?.toLowerCase() ??
        (token.email as string | undefined)?.toLowerCase()
      )?.toLowerCase();

      if (!loginEmail) return token;

      const { data: realUser } = await supabase
        .from('app_users')
        .select('role, is_active, is_events_team, is_accounting, can_impersonate, theme_preference, tour_completed_at, tour_last_role')
        .eq('email', loginEmail)
        .maybeSingle();

      const realCanImpersonate = Boolean((realUser as { can_impersonate?: boolean } | null)?.can_impersonate);

      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as Record<string, unknown>;
        const themePref = s.themePreference;
        if (
          typeof themePref === 'string' &&
          (themePref === 'light' || themePref === 'dark' || themePref === 'system')
        ) {
          await supabase.from('app_users').update({ theme_preference: themePref }).eq('email', loginEmail);
          token.theme_preference = themePref;
        }
        if (s.impersonationClear === true) {
          const prev = (token.impersonation_target_email as string | undefined)?.toLowerCase();
          if (prev) {
            await logImpersonationEnded(loginEmail, prev, 'manual');
          }
          token.impersonation_target_email = null;
          token.impersonation_target_name = null;
          token.impersonation_started_at = null;
        } else if (typeof s.impersonationTarget === 'string') {
          const raw = s.impersonationTarget.trim().toLowerCase();
          const existing = (token.impersonation_target_email as string | undefined)?.toLowerCase();
          if (raw && raw !== loginEmail && realCanImpersonate) {
            const { data: targetUser } = await supabase
              .from('app_users')
              .select('email, is_active')
              .eq('email', raw)
              .maybeSingle();
            if (targetUser?.is_active && raw !== existing) {
              await logImpersonationStarted(loginEmail, raw);
              token.impersonation_target_email = raw;
              token.impersonation_started_at = Date.now();
            }
          }
        }
      }

      if (!realUser?.is_active) {
        token.role = 'viewer';
        token.pipeline_access = false;
        token.is_accounting = false;
        token.is_events_team = false;
        token.real_can_impersonate = false;
        token.impersonation_target_email = null;
        token.impersonation_target_name = null;
        token.impersonation_started_at = null;
        token.effective_role_description = 'Inactive';
        return token;
      }

      let impEmail = (token.impersonation_target_email as string | null | undefined)?.toLowerCase() ?? null;
      const impStarted = token.impersonation_started_at as number | null | undefined;

      if (impEmail && impStarted) {
        if (!realCanImpersonate) {
          impEmail = null;
          token.impersonation_target_email = null;
          token.impersonation_target_name = null;
          token.impersonation_started_at = null;
        } else if (Date.now() - impStarted > IMPERSONATION_TTL_MS) {
          await logImpersonationEnded(loginEmail, impEmail, 'expired');
          impEmail = null;
          token.impersonation_target_email = null;
          token.impersonation_target_name = null;
          token.impersonation_started_at = null;
        } else {
          const { data: tLive } = await supabase.from('app_users').select('is_active').eq('email', impEmail).maybeSingle();
          if (!tLive?.is_active) {
            impEmail = null;
            token.impersonation_target_email = null;
            token.impersonation_target_name = null;
            token.impersonation_started_at = null;
          }
        }
      }

      const effectiveEmail = impEmail && realCanImpersonate ? impEmail : loginEmail;

      const flags = await computeAccessFlagsForEmail(effectiveEmail, supabase);
      token.role = flags.role;
      token.is_events_team = flags.is_events_team;
      token.is_accounting = flags.is_accounting;
      token.pipeline_access = flags.pipeline_access;
      token.real_can_impersonate = realCanImpersonate;

      const tp = (realUser as { theme_preference?: string | null } | null)?.theme_preference;
      token.theme_preference = tp === 'light' || tp === 'dark' || tp === 'system' ? tp : null;
      token.tour_completed_at = (realUser as { tour_completed_at?: string | null } | null)?.tour_completed_at ?? null;
      token.tour_last_role = (realUser as { tour_last_role?: string | null } | null)?.tour_last_role ?? null;

      if (impEmail && token.impersonation_started_at) {
        const d = await loadImpersonationTargetDisplay(impEmail);
        token.impersonation_target_name = d.name;
        token.effective_role_description = d.role_description;
      } else {
        const d = await loadImpersonationTargetDisplay(loginEmail);
        token.effective_role_description = d.role_description;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user?.email) return session;

      session.user.role = (token.role as UserRole) ?? 'sales';
      session.user.is_events_team = Boolean(token.is_events_team);
      session.user.is_accounting = Boolean(token.is_accounting);
      session.user.pipeline_access = Boolean(token.pipeline_access);
      session.user.can_impersonate = Boolean(token.real_can_impersonate);
      session.user.theme_preference =
        token.theme_preference === 'light' ||
        token.theme_preference === 'dark' ||
        token.theme_preference === 'system'
          ? token.theme_preference
          : null;
      session.user.tour_completed_at = (token.tour_completed_at as string | null | undefined) ?? null;
      session.user.tour_last_role = (token.tour_last_role as string | null | undefined) ?? null;

      const target = (token.impersonation_target_email as string | null | undefined)?.toLowerCase() ?? null;
      const started = token.impersonation_started_at as number | null | undefined;

      if (target && started && Date.now() - started <= IMPERSONATION_TTL_MS) {
        session.impersonation = {
          active: true,
          target_email: target,
          target_name: (token.impersonation_target_name as string | null) ?? null,
          started_at: new Date(started).toISOString(),
          role_description: (token.effective_role_description as string) ?? 'User',
        };
        session.is_read_only_impersonation = true;
      } else {
        session.impersonation = null;
        session.is_read_only_impersonation = false;
      }

      return session;
    },
  },
  session: { strategy: 'jwt' },
});
