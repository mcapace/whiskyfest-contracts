'use client';

import { createContext, useContext } from 'react';
import type { PortalKind } from '@/lib/portal-host';

const PortalContext = createContext<PortalKind>('whiskyfest');

export function PortalProvider({ kind, children }: { kind: PortalKind; children: React.ReactNode }) {
  return <PortalContext.Provider value={kind}>{children}</PortalContext.Provider>;
}

export function usePortalKind(): PortalKind {
  return useContext(PortalContext);
}
