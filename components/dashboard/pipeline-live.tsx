'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { subscribeToAppContractEvents } from '@/lib/realtime-client';
import type { PipelineRow } from '@/lib/event-metrics';

const PipelineChart = dynamic(
  () => import('@/components/dashboard/pipeline-chart').then((m) => m.PipelineChart),
  {
    ssr: false,
    loading: () => <div className="h-[360px] w-full min-h-[360px] animate-pulse rounded-md bg-muted/25" aria-hidden />,
  },
);

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
    <div className={!reduce && pulse > 0 ? 'motion-safe:animate-wf-pipeline-flash' : undefined}>
      <PipelineChart data={data} />
    </div>
  );
}
