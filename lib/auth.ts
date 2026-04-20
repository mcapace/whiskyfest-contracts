import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getSupabaseAdmin } from '@/lib/supabase';

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        .single();

      if (!appUser || !appUser.is_active) {
        // Auto-provision new @mshanken.com users as 'sales' role
        await supabase.from('app_users').upsert({
          email,
          name: user.name,
          role: 'sales',
          is_active: true,
        });
      }

      return true;
    },
    async session({ session }) {
      if (!session.user?.email) return session;

      const supabase = getSupabaseAdmin();
      const { data: appUser } = await supabase
        .from('app_users')
        .select('role, name')
        .eq('email', session.user.email.toLowerCase())
        .single();

      if (appUser) {
        session.user.role = appUser.role;
      }
      return session;
    },
  },
  session: { strategy: 'jwt' },
});
