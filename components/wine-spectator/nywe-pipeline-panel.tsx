import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PipelineLive } from '@/components/dashboard/pipeline-live';
import type { PipelineRow } from '@/lib/event-metrics';

export function NywePipelinePanel({ data }: { data: PipelineRow[] }) {
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card className="h-full border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-4">
        <div>
          <CardTitle className="font-display text-xl font-medium">Contract pipeline</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} active contract{total === 1 ? '' : 's'} — click a stage to filter
          </p>
        </div>
        <Link href="/wine-spectator/contracts" className="text-sm font-medium text-accent-brand hover:underline">
          All contracts
        </Link>
      </CardHeader>
      <CardContent className="pt-0 pb-6">
        <PipelineLive data={data} />
      </CardContent>
    </Card>
  );
}
