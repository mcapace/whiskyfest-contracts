import dynamic from 'next/dynamic';

function ContractDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading contract">
      <div className="h-10 animate-pulse rounded-md bg-muted/30" />
      <div className="h-36 animate-pulse rounded-md bg-muted/25" />
      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden h-48 animate-pulse rounded-md bg-muted/20 xl:block" />
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-lg bg-muted/25" />
          <div className="h-48 animate-pulse rounded-lg bg-muted/20" />
          <div className="h-32 animate-pulse rounded-lg bg-muted/25" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-lg bg-muted/20" />
            <div className="h-64 animate-pulse rounded-lg bg-muted/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full contract detail — client-only to prevent React #418 hydration crashes on corporate PCs. */
export const ContractDetailViewClient = dynamic(
  () =>
    import('@/components/contracts/contract-detail-view').then((m) => ({
      default: m.ContractDetailView,
    })),
  { ssr: false, loading: () => <ContractDetailSkeleton /> },
);
