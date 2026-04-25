import Link from 'next/link';
import type { DeadlineRow } from '@/lib/event-metrics';
import { Card, CardContent } from '@/components/ui/card';

export function UpcomingDeadlines({ deadlines }: { deadlines: DeadlineRow[] }) {
  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">Needs Attention</h3>
        {deadlines.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">All clear - no items need attention.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 border-b border-parchment-200 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans font-medium text-oak-800">{d.label}</p>
                  <p className="font-sans text-xs text-ink-500">{d.detail}</p>
                </div>
                <Link href={d.link} className="ml-4 whitespace-nowrap text-sm font-medium text-amber-600 hover:text-amber-700">
                  Review →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
