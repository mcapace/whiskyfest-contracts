'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SalesRepOption {
  id: string;
  name: string;
  email: string;
}

interface Props {
  currentUserEmail: string | null;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

export function SalesRepSelect({ currentUserEmail, value, onChange, required = true, disabled }: Props) {
  const [reps, setReps] = useState<SalesRepOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sales-reps');
        if (!res.ok) throw new Error('Failed to load sales reps');
        const body = (await res.json()) as { sales_reps?: SalesRepOption[] };
        if (cancelled) return;
        const list = body.sales_reps ?? [];
        setReps(list);

        if (!value && currentUserEmail) {
          const match = list.find((r) => r.email.toLowerCase() === currentUserEmail.toLowerCase());
          if (match) onChange(match.id);
        }
      } catch (err) {
        console.error('Sales reps load failed:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally run only once for initial prefill check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="sales_rep_id">
        Sales Rep {required && <span className="text-destructive">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled || !loaded}>
        <SelectTrigger id="sales_rep_id">
          <SelectValue placeholder="Select a sales rep" />
        </SelectTrigger>
        <SelectContent className="z-[80] border-border bg-card shadow-xl">
          {reps.map((rep) => (
            <SelectItem key={rep.id} value={rep.id} className="text-foreground focus:bg-muted focus:text-foreground">
              {rep.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Deal owner used for reporting and executed-contract notifications.
      </p>
    </div>
  );
}
