'use client';

import { useState, useTransition } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i) ?? header.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || fallback;
}

export function NyweBoothQrBookButton({
  readyCount,
  eventYear,
}: {
  readyCount: number;
  eventYear: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function downloadBook() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/wine-spectator/booth-qr-book', { method: 'POST' });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(json.error ?? 'Could not download the QR book.');
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filenameFromHeader(res.headers.get('Content-Disposition'), `NYWE ${eventYear} booth QR book.zip`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    });
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={downloadBook}
        disabled={pending || readyCount === 0}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <BookOpen className="h-3.5 w-3.5" aria-hidden />}
        {pending ? 'Building QR book…' : 'Download QR book'}
      </Button>
      <p className="text-xs text-muted-foreground">PDF book plus PNG and SVG files</p>
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
