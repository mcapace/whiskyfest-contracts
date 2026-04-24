'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function BubbleRemoveConfirm({ bubbleId, token }: { bubbleId: string; token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(reason?: string) {
    setErr(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/bubbles/${bubbleId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === 'string' ? j.error : 'Remove failed');
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => submit()}>
          Confirm remove
        </Button>
        <Button type="button" variant="outline" disabled={pending} asChild>
          <Link href="/">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
