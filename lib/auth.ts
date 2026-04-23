import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessibleSalesRepIds } from '@/lib/rep-access';
import type { UserRole } from '@/types/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'select_account',
          // Restrict to @mshanken.com workspace accounts
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

      // Domain gate — defense in depth; Google `hd` param already enforces this
      if (!email.endsWith('@mshanken.com')) return false;

      // Check the allowlist in Supabase
      const supabase = getSupabaseAdmin();
      const { data: appUser } = await supabase
        .from('app_users')
        .select('email, is_active, role')
        .eq('email', email)
        .maybeSingle();

      if (!appUser) {
        await supabase.from('app_users').upsert({
          email,
          name: user.name,
          role: 'sales',
          is_active: true,
        });
        return true;
      }

      if (!appUser.is_active) return false;

      return true;
    },
    async jwt({ token }) {
      const email = (token.email as string | undefined)?.toLowerCase();
      if (!email) return token;

      const supabase = getSupabaseAdmin();
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, is_active, is_events_team, is_accounting')
        .eq('email', email)
        .maybeSingle();

      if (!appUser?.is_active) {
        token.pipeline_access = false;
        token.is_accounting = false;
        token.is_events_team = false;
        return token;
      }

      const accessibleSalesRepIds = await getAccessibleSalesRepIds(email, supabase);
      const isAdmin = appUser.role === 'admin';
      const isEventsTeam = Boolean((appUser as { is_events_team?: boolean }).is_events_team);
      const isAccounting = Boolean((appUser as { is_accounting?: boolean }).is_accounting);
      const hasRep = accessibleSalesRepIds.length > 0;

      token.role = appUser.role;
      token.is_events_team = isEventsTeam;
      token.is_accounting = isAccounting;
      token.pipeline_access = isAdmin || isEventsTeam || hasRep;
      return token;
    },
    async session({ session, token }) {
      if (!session.user?.email) return session;

      session.user.role = (token.role as UserRole) ?? 'sales';
      session.user.is_events_team = Boolean(token.is_events_team);
      session.user.is_accounting = Boolean(token.is_accounting);
      session.user.pipeline_access = Boolean(token.pipeline_access);
      return session;
    },
  },
  session: { strategy: 'jwt' },
});
