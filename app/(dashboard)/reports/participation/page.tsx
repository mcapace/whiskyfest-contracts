import { redirect } from 'next/navigation';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { buildParticipationReport } from '@/lib/participation-report';
import { canAccessParticipationReport } from '@/lib/participation-report-shared';
import { ParticipationReportClient } from '@/components/reports/participation-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function ParticipationReportPage() {
  const actor = await requireContractActorForPage();
  if (!canAccessParticipationReport(actor.email)) {
    redirect('/');
  }

  const report = await buildParticipationReport();
  if (!report) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-4xl font-medium tracking-tight">Participation report</h1>
        <p className="text-sm text-muted-foreground">No active WhiskyFest event found.</p>
      </div>
    );
  }

  return <ParticipationReportClient initial={report} />;
}
