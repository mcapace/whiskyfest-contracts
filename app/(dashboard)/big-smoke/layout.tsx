import type { Metadata } from 'next';
import { requireBigSmokePageAccess } from '@/lib/auth-big-smoke';
import { BIG_SMOKE_LOGIN_TAGLINE, BIG_SMOKE_PORTAL_TITLE } from '@/lib/big-smoke-copy';

export const metadata: Metadata = {
  title: BIG_SMOKE_PORTAL_TITLE,
  description: BIG_SMOKE_LOGIN_TAGLINE,
};

export default async function BigSmokeLayout({ children }: { children: React.ReactNode }) {
  await requireBigSmokePageAccess();
  return children;
}
