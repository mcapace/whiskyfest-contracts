'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';

/** Refreshes dashboard RSC data when contracts change (broadcast + tab focus). */
export function DashboardLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const off = subscribeToAppContractEvents(() => {
      router.refresh();
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [router]);

  return null;
}
