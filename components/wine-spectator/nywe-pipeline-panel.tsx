import { Card, CardContent } from '@/components/ui/card';
import { PipelineLive } from '@/components/dashboard/pipeline-live';
import type { PipelineRow } from '@/lib/event-metrics';

export function NywePipelinePanel({ data }: { data: PipelineRow[] }) {
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-medium text-foreground">Pipeline</h2>
        <p className="nywe-subhead mt-1 text-sm text-muted-foreground">
          {total} active contract{total === 1 ? '' : 's'} — click a stage to&nbsp;filter
        </p>
      </div>
      <Card className="bg-card">
        <CardContent className="p-6">
          <PipelineLive data={data} />
        </CardContent>
      </Card>
    </section>
  );
}
