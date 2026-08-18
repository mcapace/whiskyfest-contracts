'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/contracts/status-badge';
import type { ContractStatus } from '@/types/db';

export type NyweSearchContract = {
  id: string;
  exhibitor_company_name: string;
  exhibitor_legal_name: string | null;
  signer_1_name: string | null;
  signer_1_email: string | null;
  brands_poured: string | null;
  status: ContractStatus;
  order_type: string | null;
};

function dealLabel(orderType: string | null) {
  return orderType === 'sponsorship_only' ? 'Sponsorship' : 'Vendor license';
}

export function NyweHomeSearch({ contracts }: { contracts: NyweSearchContract[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q.length < 2) return [];
    return contracts
      .filter((c) => {
        const haystack = [
          c.exhibitor_company_name,
          c.exhibitor_legal_name,
          c.signer_1_name,
          c.signer_1_email,
          c.brands_poured,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [contracts, q]);

  return (
    <section className="rounded-2xl border border-fest-600/15 bg-white p-4 shadow-sm sm:p-5">
      <label htmlFor="nywe-home-search" className="sr-only">
        Search winery, legal name, signer, or brand
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="nywe-home-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search winery, legal name, signer, brand, or email…"
          className="h-11 border-border/70 bg-muted/20 pl-10 pr-10 text-sm shadow-none focus-visible:bg-background"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {q.length >= 2 ? (
        <ul className="mt-3 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
          {matches.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No exhibitors match “{query.trim()}”.</li>
          ) : (
            matches.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/wine-spectator/contracts/${c.id}`}
                  className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.exhibitor_company_name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[c.exhibitor_legal_name, c.signer_1_name, dealLabel(c.order_type)]
                        .filter((v) => v && v !== c.exhibitor_company_name)
                        .join(' · ')}
                    </p>
                  </div>
                  <StatusBadge status={c.status} className="shrink-0" />
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Type at least two characters. Matches winery, legal/bill-to name, signer, and brands poured.
        </p>
      )}
    </section>
  );
}
