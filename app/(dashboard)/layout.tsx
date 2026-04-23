import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPaletteProvider } from '@/components/command-palette/command-palette';
import { DashboardTopBarActions } from '@/components/layout/dashboard-top-bar-actions';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { AuthSessionProvider } from '@/components/session/auth-session-provider';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const readOnly = Boolean(session.is_read_only_impersonation);
  const mainPad = readOnly ? 'pt-14' : '';
  const pipelineAccess = Boolean(session.user.pipeline_access);
  const isAccounting = Boolean(session.user.is_accounting);
  const accountingOnly = isAccounting && !pipelineAccess;
  const showAccountingNav = isAccounting || session.user.role === 'admin';

  return (
    <AuthSessionProvider>
      <CommandPaletteProvider>
        <ImpersonationBanner />
        <div className="min-h-screen bg-bg-page">
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
          <div className={`flex min-h-screen flex-col lg:pl-64 ${mainPad}`}>
            <Topbar endSlot={<DashboardTopBarActions />} />
            <main className="flex-1">
              <div className="mx-auto max-w-6xl animate-fade-in px-6 py-6 pb-24 lg:px-10 lg:py-8 lg:pb-10">
                {children}
              </div>
            </main>
          </div>
          <MobileBottomNav accountingOnly={accountingOnly} showAdminLinks={showAccountingNav} />
        </div>
      </CommandPaletteProvider>
    </AuthSessionProvider>
  );
}
