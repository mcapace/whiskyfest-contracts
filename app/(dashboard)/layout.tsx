import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPaletteProvider } from '@/components/command-palette/command-palette';
import { DashboardTopBarActions } from '@/components/layout/dashboard-top-bar-actions';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { AuthSessionProvider } from '@/components/session/auth-session-provider';
import { DashboardKeyboardShortcuts } from '@/components/keyboard-shortcuts/dashboard-keyboard-shortcuts';
import { ImpersonationBanner } from '@/components/impersonation/impersonation-banner';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';
import { DailyBubbleSlot } from '@/components/daily-bubble/daily-bubble-slot';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  const readOnly = Boolean(session.is_read_only_impersonation);
  /* Clear fixed impersonation banner (taller amber strip + two-line copy on small screens). */
  const mainPad = readOnly ? 'pt-24 sm:pt-20' : '';
  const pipelineAccess = Boolean(session.user.pipeline_access);
  const isAccounting = Boolean(session.user.is_accounting);
  const accountingOnly = isAccounting && !pipelineAccess;
  const showAccountingNav = isAccounting || session.user.role === 'admin';
  let pendingAccessRequests = 0;
  if (session.user.role === 'admin') {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    pendingAccessRequests = error ? 0 : count ?? 0;
  }

  return (
    <AuthSessionProvider>
      <DashboardKeyboardShortcuts>
      <CommandPaletteProvider>
        <ImpersonationBanner />
        <div className="min-h-screen bg-bg-page">
          <TutorialProvider />
          <Sidebar
            user={{
              email: session.user.email,
              name: session.user.name,
              role: session.user.role ?? 'sales',
              pipelineAccess: Boolean(session.user.pipeline_access),
              isAccounting: Boolean(session.user.is_accounting),
              isEventsTeam: Boolean(session.user.is_events_team),
            }}
            canImpersonate={Boolean(session.user.can_impersonate)}
            readOnlyImpersonation={readOnly}
            pendingAccessRequests={pendingAccessRequests}
          />
          <div className={`flex min-h-screen flex-col lg:pl-64 ${mainPad}`}>
            <Topbar endSlot={<DashboardTopBarActions />} />
            <DailyBubbleSlot />
            <main className="flex-1">
              <div className="mx-auto max-w-6xl animate-fade-in px-6 py-6 pb-24 lg:px-10 lg:py-8 lg:pb-10">
                {children}
              </div>
            </main>
          </div>
          <MobileBottomNav accountingOnly={accountingOnly} showAdminLinks={showAccountingNav} />
        </div>
      </CommandPaletteProvider>
      </DashboardKeyboardShortcuts>
    </AuthSessionProvider>
  );
}
