'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, QrCode } from 'lucide-react';
import { ActionWithHelp } from '@/components/contract/action-with-help';
import {
  ContractActionButtonLabel,
  contractActionBtnPrimary,
  contractActionBtnSecondary,
} from '@/components/contract/contract-action-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONTRACT_ACTION_HELP } from '@/lib/contract-action-help-text';
import type { RebrandlyQrFormat } from '@/lib/rebrandly';
import { downloadNyweBoothQrFile } from '@/components/wine-spectator/nywe-booth-qr-row-download';

export function NyweBoothQrActions({
  contractId,
  exhibitorName,
  websiteUrl,
  shortUrl,
  clicks,
}: {
  contractId: string;
  exhibitorName: string;
  websiteUrl: string | null;
  shortUrl: string | null;
  clicks: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingFormat, setPendingFormat] = useState<RebrandlyQrFormat | null>(null);
  const [draftUrl, setDraftUrl] = useState(websiteUrl ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const hasUrl = Boolean(websiteUrl?.trim());

  function saveWebsite() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/booth-qr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: draftUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? 'Could not save website.');
        return;
      }
      router.refresh();
    });
  }

  function downloadQr(format: RebrandlyQrFormat) {
    setMessage(null);
    setPendingFormat(format);
    startTransition(async () => {
      try {
        await downloadNyweBoothQrFile(contractId, exhibitorName, format);
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Could not download booth QR.');
      } finally {
        setPendingFormat(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      {hasUrl ? (
        <div className="space-y-1.5">
          <ActionWithHelp helpText={CONTRACT_ACTION_HELP.downloadBoothQr}>
            <Button
              className={contractActionBtnPrimary}
              onClick={() => downloadQr('png')}
              disabled={pending}
            >
              <ContractActionButtonLabel
                icon={pendingFormat === 'png' ? Loader2 : Download}
                label="Download PNG"
                spinning={pendingFormat === 'png'}
              />
            </Button>
          </ActionWithHelp>
          <ActionWithHelp helpText={CONTRACT_ACTION_HELP.downloadBoothQr}>
            <Button
              className={contractActionBtnSecondary}
              onClick={() => downloadQr('svg')}
              disabled={pending}
            >
              <ContractActionButtonLabel
                icon={pendingFormat === 'svg' ? Loader2 : Download}
                label="Download SVG"
                spinning={pendingFormat === 'svg'}
              />
            </Button>
          </ActionWithHelp>
        </div>
      ) : (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <p className="text-sm font-medium text-amber-950">Add a winery website before printing the booth QR.</p>
          <Input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://winery.com"
            className="h-9 bg-white text-sm"
            aria-label="Winery website URL"
          />
          <Button className={contractActionBtnSecondary} onClick={saveWebsite} disabled={pending || !draftUrl.trim()}>
            <ContractActionButtonLabel
              icon={pending ? Loader2 : QrCode}
              label="Save website"
              spinning={pending}
            />
          </Button>
        </div>
      )}
      {shortUrl ? (
        <p className="text-xs text-muted-foreground">
          {clicks} scan{clicks === 1 ? '' : 's'} · {shortUrl.replace(/^https?:\/\//, '')}
        </p>
      ) : null}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
