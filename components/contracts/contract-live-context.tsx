'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContractStatus } from '@/types/db';

type Ctx = {
  optimisticStatus: ContractStatus | null;
  setOptimisticStatus: (s: ContractStatus | null) => void;
};

const ContractLiveContext = createContext<Ctx | null>(null);

export function ContractLiveProvider({ children }: { children: ReactNode }) {
  const [optimisticStatus, setOptimisticStatus] = useState<ContractStatus | null>(null);
  const value = useMemo(
    () => ({
      optimisticStatus,
      setOptimisticStatus,
    }),
    [optimisticStatus],
  );
  return <ContractLiveContext.Provider value={value}>{children}</ContractLiveContext.Provider>;
}

export function useContractLiveOptional(): Ctx | null {
  return useContext(ContractLiveContext);
}

export function useContractLive(): Ctx {
  const c = useContext(ContractLiveContext);
  if (!c) throw new Error('useContractLive must be used within ContractLiveProvider');
  return c;
}
