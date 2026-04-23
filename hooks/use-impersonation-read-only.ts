'use client';

import { useSession } from 'next-auth/react';

export function useImpersonationReadOnly(): boolean {
  const { data } = useSession();
  return Boolean(data?.is_read_only_impersonation);
}
