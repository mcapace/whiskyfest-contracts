'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Copy plain text to the clipboard with brief success feedback. */
export function CopyTextButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for older browsers / denied clipboard
      const ta = document.createElement('textarea');
      ta.value = trimmed;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-8 gap-1.5', className)}
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/** Read-only notes panel with a one-click copy for ledger paste. */
export function CopyableNotesPanel({
  title,
  hint,
  text,
  emptyLabel = 'No notes',
  className,
}: {
  title: string;
  hint?: string;
  text: string | null | undefined;
  emptyLabel?: string;
  className?: string;
}) {
  const trimmed = text?.trim() ?? '';
  return (
    <div className={cn('rounded-lg border border-border/60 bg-card/40 p-4 md:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold">{title}</h3>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {trimmed ? <CopyTextButton text={trimmed} label="Copy notes" /> : null}
      </div>
      {trimmed ? (
        <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border/50 bg-background/80 p-3 font-sans text-sm leading-relaxed text-foreground">
          {trimmed}
        </pre>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
