'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';

export function ContractDetailRealtime({ contractId }: { contractId: string }) {
  const router = useRouter();

  useEffect(() => {
    const off = subscribeToAppContractEvents((id) => {
      if (!id || id === contractId) router.refresh();
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [contractId, router]);

  return null;
}
