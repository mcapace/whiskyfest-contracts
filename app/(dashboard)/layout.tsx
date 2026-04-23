import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthSessionProvider } from '@/components/session/auth-session-provider';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const readOnly = Boolean(session.is_read_only_impersonation);
  const mainPad = readOnly ? 'pt-14' : '';

  return (
    <AuthSessionProvider session={session}>
      <ImpersonationBanner />
      <div className="min-h-screen bg-gradient-to-br from-fest-600/[0.06] via-background to-background">
        <Sidebar
          user={{
            email: session.user.email,
            name: session.user.name,
            role: session.user.role ?? 'sales',
            pipelineAccess: Boolean(session.user.pipeline_access),
            isAccounting: Boolean(session.user.is_accounting),
          }}
          canImpersonate={Boolean(session.user.can_impersonate)}
          readOnlyImpersonation={readOnly}
        />
        <main className={`lg:pl-64 ${mainPad}`}>
          <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10 lg:py-10 animate-fade-in">{children}</div>
        </main>
      </div>
    </AuthSessionProvider>
  );
}
