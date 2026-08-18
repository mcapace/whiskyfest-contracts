'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function NyweBoothQrUrlEditor({
  contractId,
  websiteUrl,
}: {
  contractId: string;
  websiteUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!websiteUrl?.trim());
  const [draft, setDraft] = useState(websiteUrl ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/booth-qr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: draft }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; exhibitor_website_url?: string };
      if (!res.ok) {
        setError(json.error ?? 'Could not save website.');
        return;
      }
      setEditing(false);
      if (json.exhibitor_website_url) setDraft(json.exhibitor_website_url);
      router.refresh();
    });
  }

  if (!editing && websiteUrl) {
    return (
      <div className="flex min-w-[16rem] max-w-[22rem] items-center gap-2">
        <a
          href={websiteUrl}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-xs text-muted-foreground hover:underline"
          title={websiteUrl}
        >
          {websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={() => {
            setDraft(websiteUrl);
            setEditing(true);
          }}
        >
          <Pencil className="mr-1 h-3 w-3" aria-hidden />
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-[16rem] max-w-[22rem] space-y-1">
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape' && websiteUrl) {
              setDraft(websiteUrl);
              setEditing(false);
            }
          }}
          placeholder="https://winery.com or URL with UTM"
          className="h-8 bg-background text-xs"
          aria-label="Winery website URL"
        />
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0 px-2"
          onClick={save}
          disabled={pending || !draft.trim()}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
          Save
        </Button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
