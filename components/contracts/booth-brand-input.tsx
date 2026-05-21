'use client';

import { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Label } from '@/components/ui/input';

export type BoothBrandValue = {
  brand_name: string;
  expressions: string[];
};

type Props = {
  boothNumber: number;
  value: BoothBrandValue;
  onChange: (next: BoothBrandValue) => void;
  disabled?: boolean;
};

/** Split pasted comma-separated text into trimmed tokens. */
function tokensFromText(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BoothBrandInput({ boothNumber, value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitTokens = useCallback(
    (extra: string) => {
      const extraTokens = tokensFromText(extra);
      if (extraTokens.length === 0) return;
      onChange({
        brand_name: value.brand_name,
        expressions: [...value.expressions, ...extraTokens],
      });
      setDraft('');
    },
    [onChange, value.brand_name, value.expressions],
  );

  function removeExpression(idx: number) {
    onChange({
      brand_name: value.brand_name,
      expressions: value.expressions.filter((_, i) => i !== idx),
    });
  }

  return (
    <section
      className="rounded-lg border border-border/60 bg-muted/10 p-4"
      aria-labelledby={`booth-brand-heading-${boothNumber}`}
    >
      <h3 id={`booth-brand-heading-${boothNumber}`} className="font-serif text-lg font-semibold text-foreground">
        Booth {boothNumber}
      </h3>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor={`booth-brand-name-${boothNumber}`}>
          Brand name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={`booth-brand-name-${boothNumber}`}
          value={value.brand_name}
          onChange={(e) => onChange({ ...value, brand_name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          placeholder="e.g. Don Julio"
          autoComplete="off"
          disabled={disabled}
          required
          aria-required="true"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor={`booth-expr-${boothNumber}`}>Expressions</Label>
        <p id={`booth-expr-hint-${boothNumber}`} className="text-xs text-muted-foreground">
          One brand per booth. List the specific expressions you&apos;ll pour — type and press comma or Enter to add each.
        </p>
        {value.expressions.length > 0 ? (
          <div
            className="mb-2 flex flex-wrap gap-1.5"
            role="list"
            aria-label={`Expressions for booth ${boothNumber}`}
          >
            {value.expressions.map((exp, i) => (
              <span
                key={`${exp}-${i}`}
                role="listitem"
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-parchment-100 px-2.5 py-1 text-xs font-medium text-foreground dark:bg-muted"
              >
                {exp}
                <button
                  type="button"
                  className={cn(
                    'rounded-full p-0.5 text-muted-foreground hover:bg-black/5 hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
                  )}
                  onClick={() => removeExpression(i)}
                  disabled={disabled}
                  aria-label={`Remove ${exp}`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <Input
          ref={inputRef}
          id={`booth-expr-${boothNumber}`}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',') || v.includes(';')) {
              commitTokens(v);
              return;
            }
            setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (draft.trim()) commitTokens(draft);
            } else if (e.key === 'Backspace' && draft === '' && value.expressions.length > 0) {
              removeExpression(value.expressions.length - 1);
            }
          }}
          onBlur={() => {
            if (draft.trim()) commitTokens(draft);
          }}
          placeholder="Blanco, Reposado, …"
          autoComplete="off"
          disabled={disabled}
          aria-describedby={`booth-expr-hint-${boothNumber}`}
        />
      </div>
    </section>
  );
}
