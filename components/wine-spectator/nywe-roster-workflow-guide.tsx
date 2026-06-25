'use client';

import { CheckCircle2, Circle, ArrowRight, Mail, FilePlus2, ShieldCheck, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type NyweWorkflowStepId = 'create' | 'approve' | 'send' | 'countersign';

type StepCounts = {
  notStarted: number;
  inProgress: number;
  needsReview: number;
  approved: number;
  waitingOnWinery: number;
};

type Props = {
  counts: StepCounts;
  activeStep: NyweWorkflowStepId;
  filter: string;
  selectedCreatable: number;
  approvedReadyToSend: number;
  clientSendEnabled: boolean;
  onSetFilter: (filter: string) => void;
  onSelectAllCreatable: () => void;
  onCreateDrafts: () => void;
  onSendAllApproved: () => void;
};

type StepDef = {
  id: NyweWorkflowStepId;
  number: number;
  title: string;
  summary: string;
  icon: typeof FilePlus2;
};

const STEPS: StepDef[] = [
  {
    id: 'create',
    number: 1,
    title: 'Create drafts',
    summary: 'Wineries marked Not in system need a license draft first.',
    icon: FilePlus2,
  },
  {
    id: 'approve',
    number: 2,
    title: 'Approve PDFs',
    summary: 'Open each license, check the PDF, then click Approve.',
    icon: ShieldCheck,
  },
  {
    id: 'send',
    number: 3,
    title: 'Send to wineries',
    summary: 'One click emails DocuSign signing links to every approved winery.',
    icon: Mail,
  },
  {
    id: 'countersign',
    number: 4,
    title: 'Countersign in DocuSign',
    summary: 'When they sign, open your DocuSign email and countersign. Accounting is notified automatically.',
    icon: PenLine,
  },
];

function stepStatus(
  stepId: NyweWorkflowStepId,
  activeStep: NyweWorkflowStepId,
  counts: StepCounts,
): 'done' | 'current' | 'upcoming' {
  const order: NyweWorkflowStepId[] = ['create', 'approve', 'send', 'countersign'];
  const stepIndex = order.indexOf(stepId);
  const activeIndex = order.indexOf(activeStep);

  const doneByCounts: Record<NyweWorkflowStepId, boolean> = {
    create: counts.notStarted === 0,
    approve: counts.inProgress === 0 && counts.needsReview === 0,
    send: counts.approved === 0 && counts.waitingOnWinery > 0,
    countersign: false,
  };

  if (doneByCounts[stepId] && stepId !== activeStep) return 'done';
  if (stepId === activeStep) return 'current';
  if (stepIndex < activeIndex) return 'done';
  return 'upcoming';
}

export function resolveNyweWorkflowStep(counts: StepCounts): NyweWorkflowStepId {
  if (counts.approved > 0) return 'send';
  if (counts.inProgress > 0 || counts.needsReview > 0) return 'approve';
  if (counts.notStarted > 0) return 'create';
  if (counts.waitingOnWinery > 0) return 'countersign';
  return 'create';
}

export function NyweRosterWorkflowGuide({
  counts,
  activeStep,
  filter,
  selectedCreatable,
  approvedReadyToSend,
  clientSendEnabled,
  onSetFilter,
  onSelectAllCreatable,
  onCreateDrafts,
  onSendAllApproved,
}: Props) {
  return (
    <section className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-parchment-50 p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/70">Your workflow</p>
        <h2 className="mt-1 font-serif text-lg font-semibold text-foreground">Follow these steps in order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Boxes highlight where you are now. Step 3 sends every approved license in one click.
        </p>
      </div>

      <ol className="grid gap-3 lg:grid-cols-2">
        {STEPS.map((step) => {
          const status = stepStatus(step.id, activeStep, counts);
          const Icon = step.icon;
          const isCurrent = status === 'current';

          return (
            <li
              key={step.id}
              className={cn(
                'rounded-lg border p-4 transition-colors',
                isCurrent && 'border-rose-400/70 bg-white shadow-md ring-2 ring-rose-300/40',
                status === 'done' && 'border-emerald-200/80 bg-emerald-50/50',
                status === 'upcoming' && 'border-border/60 bg-white/60',
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    isCurrent && 'bg-rose-700 text-white',
                    status === 'done' && 'bg-emerald-600 text-white',
                    status === 'upcoming' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  ) : (
                    <Icon className="h-4 w-4" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      Step {step.number}: {step.title}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
                        You are here
                      </span>
                    ) : status === 'done' ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                        Done for now
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Circle className="h-2 w-2 fill-current" aria-hidden /> Up next
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>

                  {step.id === 'create' && isCurrent ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('not_started')}>
                        Show not in system ({counts.notStarted})
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={onSelectAllCreatable}>
                        Select all visible
                      </Button>
                      <Button type="button" size="sm" onClick={onCreateDrafts} disabled={selectedCreatable === 0}>
                        Create drafts ({selectedCreatable}) — click after selecting
                      </Button>
                    </div>
                  ) : null}

                  {step.id === 'approve' && isCurrent ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('in_progress')}>
                        Show in progress ({counts.inProgress})
                      </Button>
                      {counts.needsReview > 0 ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a href="/wine-spectator/contracts?status=pending_events_review">
                            Review queue ({counts.needsReview})
                          </a>
                        </Button>
                      ) : null}
                      <p className="w-full text-xs text-muted-foreground">
                        Open each license → check PDF → click <strong>Approve</strong>.
                      </p>
                    </div>
                  ) : null}

                  {step.id === 'send' && isCurrent ? (
                    <div className="mt-3 space-y-2">
                      {!clientSendEnabled ? (
                        <p className="text-xs text-amber-800">
                          DocuSign send is turned off — ask Mike to enable when you are ready.
                        </p>
                      ) : (
                        <>
                          {counts.approved > 0 ? (
                            <p className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
                              <strong>{counts.approved}</strong> approved license{counts.approved === 1 ? '' : 's'}{' '}
                              ready — click below to email every signer at once. No need to select rows or open each
                              license.
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={filter === 'approved' ? 'default' : 'outline'}
                              onClick={() => onSetFilter('approved')}
                            >
                              Show approved ({counts.approved})
                            </Button>
                            <Button type="button" size="sm" onClick={onSendAllApproved} disabled={approvedReadyToSend === 0}>
                              Send all approved ({approvedReadyToSend})
                              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            DocuSign emails go out immediately after you confirm. Countersign in DocuSign when wineries
                            sign back.
                          </p>
                        </>
                      )}
                    </div>
                  ) : null}

                  {step.id === 'countersign' && (isCurrent || counts.waitingOnWinery > 0) ? (
                    <div className="mt-3">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('sent')}>
                        Show waiting on winery ({counts.waitingOnWinery})
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Check your inbox for DocuSign — countersign after each winery signs. No extra step in this app.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
