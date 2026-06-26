'use client';

import { CheckCircle2, ArrowRight, Mail, FilePlus2, PenLine } from 'lucide-react';
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

const STEPS = [
  { id: 'create' as const, title: 'Create drafts', icon: FilePlus2 },
  { id: 'send' as const, title: 'Send to clients', icon: Mail },
  { id: 'countersign' as const, title: 'Countersign', icon: PenLine },
];

function stepStatus(
  stepId: NyweWorkflowStepId,
  activeStep: NyweWorkflowStepId,
  counts: StepCounts,
): 'done' | 'current' | 'upcoming' {
  const order: NyweWorkflowStepId[] = ['create', 'send', 'countersign'];
  const doneByCounts: Record<NyweWorkflowStepId, boolean> = {
    create: counts.notStarted === 0,
    send: counts.readyToSend === 0 && (counts.waitingOnWinery > 0 || counts.readyToCountersign > 0),
    countersign: false,
  };
  if (doneByCounts[stepId] && stepId !== activeStep) return 'done';
  if (stepId === activeStep) return 'current';
  if (order.indexOf(stepId) < order.indexOf(activeStep)) return 'done';
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
    <section className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workflow</p>
          <h2 className="mt-1 font-display text-lg font-medium">Bulk contract operations</h2>
        </div>
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, index) => {
            const status = stepStatus(step.id, activeStep, counts);
            const Icon = step.icon;
            return (
              <li
                key={step.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                  status === 'current' && 'border-fest-300 bg-fest-50 text-fest-950',
                  status === 'done' && 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
                  status === 'upcoming' && 'border-border/60 bg-muted/30 text-muted-foreground',
                )}
              >
                {status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="font-medium">{step.title}</span>
                {index < STEPS.length - 1 ? (
                  <ArrowRight className="h-3 w-3 opacity-40" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-4">
        {activeStep === 'create' ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('not_started')}>
              Not in system ({counts.notStarted})
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSelectAllCreatable}>
              Select all visible
            </Button>
            <Button type="button" size="sm" onClick={onCreateDrafts} disabled={selectedCreatable === 0}>
              Create drafts ({selectedCreatable})
            </Button>
          </>
        ) : null}

        {activeStep === 'send' ? (
          <>
            {!clientSendEnabled ? (
              <p className="text-sm text-amber-800">DocuSign send is off — ask Mike to enable when ready.</p>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => onSetFilter('in_progress')}
                >
                  Drafts ({counts.readyToSend})
                </Button>
                <Button type="button" size="sm" onClick={onSendAllToClients} disabled={readyToSend === 0}>
                  Send all ({readyToSend})
                </Button>
              </>
            )}
          </>
        ) : null}

        {activeStep === 'countersign' ? (
          <>
            {counts.readyToCountersign > 0 ? (
              <Button type="button" size="sm" onClick={() => onSetFilter('countersign')}>
                Ready to countersign ({counts.readyToCountersign})
              </Button>
            ) : null}
            {counts.waitingOnWinery > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onSetFilter('sent')}>
                With winery ({counts.waitingOnWinery})
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
