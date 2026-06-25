import type { Metadata } from 'next';
import { requireWineSpectatorPageAccess } from '@/lib/auth-wine-spectator';
import { NyweDocuSignStatusSync } from '@/components/wine-spectator/nywe-docusign-status-sync';

export const metadata: Metadata = {
  title: 'NYWE Contracts | Wine Spectator',
  description: 'New York Wine Experience vendor license management — M. Shanken Communications',
};

export default async function WineSpectatorLayout({ children }: { children: React.ReactNode }) {
  await requireWineSpectatorPageAccess();
  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <NyweDocuSignStatusSync />
      </div>
      {children}
    </>
  );
}
