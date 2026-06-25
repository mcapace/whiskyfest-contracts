'use client';

import { CheckCircle2, Circle, ArrowRight, Mail, FilePlus2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type NyweWorkflowStepId = 'create' | 'send' | 'countersign';

type StepCounts = {
  notStarted: number;
  readyToSend: number;
  waitingOnWinery: number;
  readyToCountersign: number;
};

type Props = {
  counts: StepCounts;
  activeStep: NyweWorkflowStepId;
  filter: string;
  selectedCreatable: number;
  readyToSend: number;
  clientSendEnabled: boolean;
  onSetFilter: (filter: string) => void;
  onSelectAllCreatable: () => void;
  onCreateDrafts: () => void;
  onSendAllToClients: () => void;
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
    id: 'send',
    number: 2,
    title: 'Send to clients',
    summary: 'One click bulk-sends every draft license. Roster data is pre-approved — no need to open each PDF.',
    icon: Mail,
  },
  {
    id: 'countersign',
    number: 3,
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
  const order: NyweWorkflowStepId[] = ['create', 'send', 'countersign'];
  const stepIndex = order.indexOf(stepId);
  const activeIndex = order.indexOf(activeStep);

  const doneByCounts: Record<NyweWorkflowStepId, boolean> = {
    create: counts.notStarted === 0,
    send: counts.readyToSend === 0 && (counts.waitingOnWinery > 0 || counts.readyToCountersign > 0),
    countersign: false,
  };

  if (doneByCounts[stepId] && stepId !== activeStep) return 'done';
  if (stepId === activeStep) return 'current';
  if (stepIndex < activeIndex) return 'done';
  return 'upcoming';
}

export function resolveNyweWorkflowStep(counts: StepCounts): NyweWorkflowStepId {
  if (counts.readyToCountersign > 0 && counts.readyToSend === 0) return 'countersign';
  if (counts.waitingOnWinery > 0 && counts.readyToSend === 0) return 'countersign';
  if (counts.readyToSend > 0) return 'send';
  if (counts.notStarted > 0) return 'create';
  if (counts.readyToCountersign > 0 || counts.waitingOnWinery > 0) return 'countersign';
  return 'create';
}

export function NyweRosterWorkflowGuide({
  counts,
  activeStep,
  filter,
  selectedCreatable,
  readyToSend,
  clientSendEnabled,
  onSetFilter,
  onSelectAllCreatable,
  onCreateDrafts,
  onSendAllToClients,
}: Props) {
  return (
    <section className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-parchment-50 p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/70">Your workflow</p>
        <h2 className="mt-1 font-serif text-lg font-semibold text-foreground">Follow these steps in order</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          After drafts are created, bulk send emails every winery — no individual approve step.
        </p>
      </div>

      <ol className="grid gap-3 lg:grid-cols-3">
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

                  {step.id === 'send' && isCurrent ? (
                    <div className="mt-3 space-y-2">
                      {!clientSendEnabled ? (
                        <p className="text-xs text-amber-800">
                          DocuSign send is turned off — ask Mike to enable when you are ready.
                        </p>
                      ) : (
                        <>
                          {readyToSend > 0 ? (
                            <p className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
                              <strong>{readyToSend}</strong> draft license{readyToSend === 1 ? '' : 's'} ready — bulk
                              send generates PDFs and emails every signer. Individual approve is not required.
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={filter === 'in_progress' ? 'default' : 'outline'}
                              onClick={() => onSetFilter('in_progress')}
                            >
                              Show drafts ({counts.readyToSend})
                            </Button>
                            <Button type="button" size="sm" onClick={onSendAllToClients} disabled={readyToSend === 0}>
                              Send all to clients ({readyToSend})
                              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}

                  {step.id === 'countersign' && (isCurrent || counts.readyToCountersign > 0 || counts.waitingOnWinery > 0) ? (
                    <div className="mt-3 space-y-2">
                      {counts.readyToCountersign > 0 ? (
                        <Button type="button" size="sm" variant="default" onClick={() => onSetFilter('countersign')}>
                          Show ready to countersign ({counts.readyToCountersign})
                        </Button>
                      ) : null}
                      {counts.waitingOnWinery > 0 ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('sent')}>
                          Show waiting on winery ({counts.waitingOnWinery})
                        </Button>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        When a winery signs, it appears under ready to countersign. Open your DocuSign inbox to sign — no
                        extra step in this app.
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
