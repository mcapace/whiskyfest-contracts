'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/** On Wine Spectator dashboard load, reconcile sent licenses with DocuSign (missed webhooks). */
export function NyweDocuSignStatusSync() {
  const router = useRouter();
  const started = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      setMessage('Checking DocuSign for winery signatures…');
      try {
        const res = await fetch('/api/wine-spectator/sync-docusign-signatures', { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(null);
          return;
        }

        const updated = (body.partiallySigned ?? 0) + (body.fullySigned ?? 0);
        if (updated > 0) {
          setMessage(
            updated === 1
              ? 'Found 1 winery signature in DocuSign — dashboard updated.'
              : `Found ${updated} winery signatures in DocuSign — dashboard updated.`,
          );
          router.refresh();
        } else {
          setMessage(null);
        }
      } catch {
        setMessage(null);
      }
    })();
  }, [router]);

  if (!message) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-sky-300/70 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
