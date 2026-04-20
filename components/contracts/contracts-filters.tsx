'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready_for_review', label: 'Ready for Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'executed', label: 'Executed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'error', label: 'Error' },
];

export function ContractsFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState(sp.get('status') ?? 'all');
  const [q, setQ] = useState(sp.get('q') ?? '');

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    const next = new URLSearchParams();
    if (status && status !== 'all') next.set('status', status);
    if (q.trim()) next.set('q', q.trim());
    const s = next.toString();
    router.push(s ? `/contracts?${s}` : '/contracts');
  }

  function clearFilters() {
    setStatus('all');
    setQ('');
    router.push('/contracts');
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1.5 sm:w-52">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Search exhibitor</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Company name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Apply</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>
          Clear
        </Button>
      </div>
    </form>
  );
}
