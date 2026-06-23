import dynamic from 'next/dynamic';

function BlockSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/25 ${className ?? ''}`} aria-hidden />;
}

/** Client-only islands on contract detail — avoids SSR/hydration crashes on older PCs. */
export const ContractDetailHeaderClient = dynamic(
  () =>
    import('@/components/contracts/contract-detail-header').then((m) => ({
      default: m.ContractDetailHeader,
    })),
  { ssr: false, loading: () => <BlockSkeleton className="mb-6 h-36 w-full" /> },
);

export const ContractProgressionTimelineClient = dynamic(
  () =>
    import('@/components/contract/progression-timeline').then((m) => ({
      default: m.ContractProgressionTimeline,
    })),
  { ssr: false, loading: () => <BlockSkeleton className="h-16 w-full" /> },
);

export const ContractActionsClient = dynamic(
  () =>
    import('@/components/contracts/contract-actions').then((m) => ({
      default: m.ContractActions,
    })),
  { ssr: false, loading: () => <BlockSkeleton className="h-28 w-full" /> },
);

export const ActivityTimelineClient = dynamic(
  () =>
    import('@/components/contracts/activity-timeline').then((m) => ({
      default: m.ActivityTimeline,
    })),
  { ssr: false, loading: () => <BlockSkeleton className="h-48 w-full" /> },
);

export const PdfPreviewClient = dynamic(
  () =>
    import('@/components/contracts/pdf-preview').then((m) => ({
      default: m.PdfPreview,
    })),
  { ssr: false, loading: () => <BlockSkeleton className="h-[480px] w-full" /> },
);
