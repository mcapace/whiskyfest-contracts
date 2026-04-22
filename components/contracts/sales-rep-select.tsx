'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/input';

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
      <select
        id="sales_rep_id"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !loaded}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Select a sales rep</option>
        {reps.map((rep) => (
          <option key={rep.id} value={rep.id}>
            {rep.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Deal owner used for reporting and executed-contract notifications.
      </p>
    </div>
  );
}
