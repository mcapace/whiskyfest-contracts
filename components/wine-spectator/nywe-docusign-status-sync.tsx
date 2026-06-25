'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NYWE_DOCUSIGN_SYNC_DONE_EVENT } from '@/lib/nywe-docusign-sync-events';

type SyncState = 'idle' | 'running' | 'done' | 'error';

function dispatchSyncDone(updated: number) {
  window.dispatchEvent(new CustomEvent(NYWE_DOCUSIGN_SYNC_DONE_EVENT, { detail: { updated } }));
}

async function runBatchedSync(): Promise<{ updated: number; error?: string }> {
  let afterId: string | null = null;
  let updated = 0;
  let batches = 0;

  while (batches < 40) {
    const params = new URLSearchParams({ batchSize: '20' });
    if (afterId) params.set('afterId', afterId);
    const res = await fetch(`/api/wine-spectator/sync-docusign-signatures?${params}`, {
      method: 'POST',
      cache: 'no-store',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { updated, error: body.error ?? `Sync failed (${res.status})` };
    }

    updated += (body.partiallySigned ?? 0) + (body.fullySigned ?? 0);
    batches += 1;

    if (!body.hasMore || !body.nextAfterId) break;
    afterId = body.nextAfterId as string;
  }

  return { updated };
}

/** Reconcile sent NYWE licenses with DocuSign on load; exposes manual refresh too. */
export function NyweDocuSignStatusSync({ autoRun = true }: { autoRun?: boolean }) {
  const router = useRouter();
  const autoStarted = useRef(false);
  const running = useRef(false);
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const runSync = useCallback(async (manual = false) => {
    if (running.current) return;
    running.current = true;
    setState('running');
    setMessage(manual ? 'Refreshing signing status from DocuSign…' : 'Checking DocuSign for winery signatures…');

    try {
      const { updated, error } = await runBatchedSync();
      if (error && updated === 0) {
        setState('error');
        setMessage(`Could not refresh signing status: ${error}`);
        return;
      }

      dispatchSyncDone(updated);
      router.refresh();

      if (updated > 0) {
        setState('done');
        setMessage(
          updated === 1 ? 'Updated 1 license from DocuSign.' : `Updated ${updated} licenses from DocuSign.`,
        );
      } else if (error) {
        setState('done');
        setMessage(`Checked DocuSign — no new signatures yet (${error}).`);
      } else {
        setState('idle');
        setMessage(null);
      }
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Signing status refresh failed.');
    } finally {
      running.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (!autoRun || autoStarted.current) return;
    autoStarted.current = true;
    void runSync(false);
  }, [autoRun, runSync]);

  if (state === 'idle' && !message) {
    return (
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void runSync(true)}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Refresh signing status
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-300/70 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="flex items-center gap-2">
        {state === 'running' ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        <span>{message}</span>
      </div>
      {state !== 'running' ? (
        <Button type="button" variant="outline" size="sm" onClick={() => void runSync(true)}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Check again
        </Button>
      ) : null}
    </div>
  );
}
