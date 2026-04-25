import type { BrandMixRow } from '@/lib/event-metrics';
import { Card, CardContent } from '@/components/ui/card';

export function BrandMixBreakdown({ categories, title }: { categories: BrandMixRow[]; title?: string }) {
  const hasData = categories.some((c) => c.count > 0);

  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">{title ?? 'Brand Mix'}</h3>
        {!hasData ? (
          <p className="mt-4 text-sm text-ink-500">Brand mix will appear once exhibitors are confirmed.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-sans text-sm text-oak-800">{cat.name}</span>
                  <span className="font-sans text-xs tabular-nums text-ink-500">
                    {cat.count} {cat.count === 1 ? 'brand' : 'brands'}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-parchment-100">
                  <div className="h-full bg-amber-500 transition-[width] duration-500" style={{ width: `${cat.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
