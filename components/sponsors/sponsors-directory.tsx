'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { SponsorCard } from '@/components/sponsors/sponsor-card';
import { SponsorProfileDrawer } from '@/components/sponsors/sponsor-profile-drawer';
import { sponsorCategoryFromBrands, type SponsorRecord } from '@/lib/sponsors';

export function SponsorsDirectory({
  sponsors,
  canViewFinancials,
}: {
  sponsors: SponsorRecord[];
  canViewFinancials: boolean;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<SponsorRecord | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(['all']);
    sponsors.forEach((s) => set.add(sponsorCategoryFromBrands(s.brands_poured)));
    return [...set];
  }, [sponsors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sponsors.filter((s) => {
      if (category !== 'all' && sponsorCategoryFromBrands(s.brands_poured) !== category) return false;
      if (!q) return true;
      const blob = `${s.exhibitor_company_name} ${s.brands_poured ?? ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [sponsors, query, category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by company or brand"
          className="max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-3 py-1 text-xs ${
                category === cat ? 'border-oak-700 bg-oak-800 text-parchment-50' : 'border-parchment-300 bg-parchment-50 text-ink-700'
              }`}
            >
              {cat === 'all' ? 'All categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-parchment-200 bg-parchment-50 px-6 py-14 text-center">
          <h3 className="font-display text-3xl font-medium text-oak-800">No sponsors confirmed yet</h3>
          <p className="mt-3 text-sm text-ink-600">As exhibitors sign their contracts, they&apos;ll appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((sponsor, index) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} index={index} onOpen={() => setSelected(sponsor)} />
          ))}
        </div>
      )}

      <p className="text-sm text-ink-500">{filtered.length} sponsor{filtered.length === 1 ? '' : 's'} shown</p>

      <SponsorProfileDrawer
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        sponsor={selected}
        canViewFinancials={canViewFinancials}
      />
    </div>
  );
}
