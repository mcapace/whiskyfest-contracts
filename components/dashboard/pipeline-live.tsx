'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';
import { PipelineChart } from '@/components/dashboard/pipeline-chart';
import type { PipelineRow } from '@/lib/event-metrics';

export function PipelineLive({ data }: { data: PipelineRow[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const off = subscribeToAppContractEvents(() => {
      setPulse((p) => p + 1);
      router.refresh();
    });
    return () => off();
  }, [router]);

  return (
    <div key={pulse} className={!reduce && pulse > 0 ? 'motion-safe:animate-wf-pipeline-flash' : undefined}>
      <PipelineChart data={data} />
    </div>
  );
}
