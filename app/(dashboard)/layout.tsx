import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/auth/login');

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={{
        email: session.user.email,
        name:  session.user.name,
        role:  session.user.role ?? 'sales',
      }} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10 lg:py-10 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
