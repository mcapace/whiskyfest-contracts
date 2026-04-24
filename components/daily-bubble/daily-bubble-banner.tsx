'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatTimestamp } from '@/lib/datetime';
import type { DailyBubblePublic } from '@/types/db';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BannerProps {
  bubble: DailyBubblePublic;
  isAdmin: boolean;
  readOnlyImpersonation: boolean;
}

function headline(contentType: DailyBubblePublic['content_type']): string {
  if (contentType === 'fact') return 'Did You Know';
  if (contentType === 'joke') return 'Dram Humor';
  return 'Quote of the Day';
}

export function DailyBubbleBanner({ bubble, isAdmin, readOnlyImpersonation }: BannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  const tooltip = `${formatTimestamp(bubble.generated_at)} · ${headline(bubble.content_type)}`;

  if (hidden) return null;

  function dismiss() {
    startTransition(async () => {
      const res = await fetch('/api/me/dismiss-bubble', { method: 'POST' });
      if (res.ok) {
        setHidden(true);
        router.refresh();
        return;
      }
      setHidden(true);
    });
  }

  function removeForAll() {
    if (!isAdmin || readOnlyImpersonation) return;
    const ok = window.confirm('Remove this bubble for everyone? It will stay hidden until tomorrow’s new bubble.');
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/bubbles/${bubble.id}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setHidden(true);
        router.refresh();
      }
    });
  }

  return (
    <div
      className={cn(
        'border-b border-fest-600/15 bg-gradient-to-r from-brass-50/90 via-background to-brass-50/80',
        'dark:from-fest-950/40 dark:via-background dark:to-fest-950/30',
      )}
      title={tooltip}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fest-700 dark:text-fest-300">
            {headline(bubble.content_type)}
          </span>
          <p className="text-sm leading-snug text-foreground">
            <span>{bubble.content}</span>
            {bubble.attribution ? (
              <span className="ml-2 italic text-muted-foreground">— {bubble.attribution}</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:pl-4">
          {isAdmin && !readOnlyImpersonation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              disabled={pending}
              onClick={removeForAll}
            >
              Remove for all
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            disabled={pending}
            onClick={dismiss}
            aria-label="Dismiss bubble for today"
          >
            ×
          </Button>
        </div>
      </div>
    </div>
  );
}
