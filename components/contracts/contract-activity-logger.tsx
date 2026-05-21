'use client';

import { useEffect, useRef } from 'react';

const VIEW_THROTTLE_MS = 30 * 60 * 1000;

function storageKey(contractId: string): string {
  return `wf-contract-view-${contractId}`;
}

/** Logs contract_viewed once per browser session per contract (throttled). */
export function ContractActivityLogger({ contractId }: { contractId: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    const key = storageKey(contractId);
    const last = sessionStorage.getItem(key);
    if (last && Date.now() - Number(last) < VIEW_THROTTLE_MS) return;

    sent.current = true;
    sessionStorage.setItem(key, String(Date.now()));

    void fetch(`/api/contracts/${contractId}/log-view`, {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {
      /* non-blocking */
    });
  }, [contractId]);

  return null;
}
