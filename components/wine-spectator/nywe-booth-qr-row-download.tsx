'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RebrandlyQrFormat } from '@/lib/rebrandly';

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i) ?? header.match(/filename=([^;]+)/i);
  return match?.[1]?.trim() || fallback;
}

export async function downloadNyweBoothQrFile(
  contractId: string,
  exhibitorName: string,
  format: RebrandlyQrFormat,
): Promise<void> {
  const res = await fetch(`/api/contracts/${contractId}/booth-qr?format=${format}`, { method: 'POST' });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not download booth QR.');
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filenameFromHeader(
    res.headers.get('Content-Disposition'),
    `${exhibitorName} NYWE booth QR.${format}`,
  );
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** Compact QR download for list/roster/dashboard rows of executed vendor licenses. */
export function NyweBoothQrRowDownload({
  contractId,
  exhibitorName,
  websiteUrl,
  missingHref,
}: {
  contractId: string;
  exhibitorName: string;
  websiteUrl: string | null | undefined;
  missingHref?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const hasUrl = Boolean(websiteUrl?.trim());

  function download(format: RebrandlyQrFormat) {
    setMessage(null);
    startTransition(async () => {
      try {
        await downloadNyweBoothQrFile(contractId, exhibitorName, format);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Could not download booth QR.');
      }
    });
  }

  if (!hasUrl) {
    return missingHref ? (
      <Link
        href={missingHref}
        className="text-xs font-medium text-amber-900 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        Need URL
      </Link>
    ) : (
      <span className="text-xs text-muted-foreground">Need URL</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            disabled={pending}
            aria-label={`Download booth QR for ${exhibitorName}`}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <QrCode className="h-3.5 w-3.5" aria-hidden />}
            QR
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem disabled={pending} onSelect={() => download('png')}>
            <Download className="mr-2 h-3.5 w-3.5" aria-hidden />
            Download PNG
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onSelect={() => download('svg')}>
            <Download className="mr-2 h-3.5 w-3.5" aria-hidden />
            Download SVG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {message ? <p className="max-w-[10rem] text-right text-[11px] text-destructive">{message}</p> : null}
    </div>
  );
}
