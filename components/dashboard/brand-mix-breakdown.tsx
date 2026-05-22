import type { BrandMixRow } from '@/lib/event-metrics';
import { getBrandCategoryVisual } from '@/lib/brand-category-visual';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export function BrandMixBreakdown({ categories, title }: { categories: BrandMixRow[]; title?: string }) {
  const hasData = categories.some((c) => c.revenueCents > 0 || c.count > 0);

  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">{title ?? 'Brand Mix'}</h3>
        {!hasData ? (
          <p className="mt-4 text-sm text-ink-500">
            Brand mix will appear once contracts include booth brands (or legacy brands poured).
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {categories.map((cat) => {
              const { Icon, bar, badge, track } = getBrandCategoryVisual(cat.name);
              return (
                <div key={cat.name}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5 font-sans text-sm text-oak-800">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
                          badge,
                        )}
                        aria-hidden
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="shrink-0 font-sans text-xs tabular-nums text-ink-500">
                      {formatCurrency(cat.revenueCents)}
                      <span className="text-ink-400">
                        {' '}
                        · {cat.count} {cat.count === 1 ? 'booth' : 'booths'}
                      </span>
                    </span>
                  </div>
                  <div className={cn('h-2 overflow-hidden rounded-full', track)}>
                    <div
                      className={cn('h-full transition-[width] duration-500', bar)}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
