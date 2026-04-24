'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BarChart3, ClipboardCheck, DollarSign, FilePlus2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TutorialRoleContext {
  role?: string | null;
  isEventsTeam?: boolean;
  isAccounting?: boolean;
  isAssistant?: boolean;
  supportedRepNames?: string[];
}

export function WelcomeTutorialModal({
  open,
  roleContext,
  onSkip,
  onStartTour,
}: {
  open: boolean;
  roleContext: TutorialRoleContext;
  onSkip: () => void;
  onStartTour: () => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const dir = 1;

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onSkip]);

  const roleHeadline = useMemo(() => {
    if (roleContext.role === 'admin') return 'As an admin, you oversee the entire workflow';
    if (roleContext.isEventsTeam) return "You'll review contracts before they go to exhibitors";
    if (roleContext.isAccounting) return "You'll see executed contracts ready to invoice";
    if (roleContext.isAssistant) return `You'll see contracts for ${roleContext.supportedRepNames?.join(', ') || 'the reps you support'}`;
    return 'Your role: create contracts and track them through signing';
  }, [roleContext]);

  const roleBullets = useMemo(() => {
    if (roleContext.role === 'admin') return ['Review + approvals', 'User and role management', 'Pipeline oversight + reporting'];
    if (roleContext.isEventsTeam) return ['Review incoming contracts', 'Approve or send back with notes', 'Maintain signatory quality'];
    if (roleContext.isAccounting) return ['Executed contract queue', 'Invoice sent / paid lifecycle', 'Close-loop notifications'];
    if (roleContext.isAssistant) return ['Scoped contract visibility', 'Rep support workflow', 'Status tracking + follow-up'];
    return ['Create contracts', 'Send via DocuSign', 'Track status to execution'];
  }, [roleContext]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background/75 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center p-0 sm:p-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-screen w-full rounded-none border-y border-border/60 bg-bg-surface-raised p-6 shadow-2xl sm:h-auto sm:max-w-2xl sm:rounded-2xl sm:border sm:p-8"
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="wf-label-caps text-[0.62rem] text-muted-foreground">Onboarding · Step {step + 1} of 4</p>
            <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onSkip}>
              Skip
            </button>
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="s1"
                initial={reduce ? false : { x: 40 * dir, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? {} : { x: -40 * dir, opacity: 0 }}
                className="space-y-4"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-brass-300 bg-brass-100/70 px-3 py-1 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  Welcome
                </div>
                <h2 className="wf-display-serif text-3xl sm:text-4xl">Welcome to WhiskyFest Contracts</h2>
                <p className="text-sm text-muted-foreground">Let&apos;s get you oriented.</p>
                <div className="pt-2">
                  <Button className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]" onClick={() => setStep(1)}>Get started</Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="s2"
                initial={reduce ? false : { x: 40 * dir, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? {} : { x: -40 * dir, opacity: 0 }}
                className="space-y-5"
              >
                <h2 className="wf-display-serif text-3xl sm:text-4xl">Contract lifecycle, automated</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Sales rep creates', Icon: FilePlus2 },
                    { label: 'Events team approves', Icon: ClipboardCheck },
                    { label: 'Exhibitor signs', Icon: ShieldCheck },
                  ].map(({ label, Icon }, i) => (
                    <motion.div
                      key={String(label)}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduce ? 0 : i * 0.08 }}
                      className="rounded-xl border border-border/60 bg-card/50 p-3"
                    >
                      <Icon className="mb-2 h-4 w-4 text-accent-brand" />
                      <p className="text-sm font-medium">{label}</p>
                    </motion.div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  From first draft to final signature, everything in one place.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                  <Button className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]" onClick={() => setStep(2)}>Next</Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s3"
                initial={reduce ? false : { x: 40 * dir, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? {} : { x: -40 * dir, opacity: 0 }}
                className="space-y-5"
              >
                <h2 className="wf-display-serif text-3xl sm:text-4xl">Your role in this system</h2>
                <p className="text-sm text-muted-foreground">{roleHeadline}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[Users, BarChart3, DollarSign].map((Icon, i) => (
                    <div key={i} className="rounded-xl border border-border/60 bg-card/50 p-3">
                      <Icon className="mb-2 h-4 w-4 text-accent-brand" />
                      <p className="text-sm">{roleBullets[i] ?? ''}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]" onClick={() => setStep(3)}>Next</Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s4"
                initial={reduce ? false : { x: 40 * dir, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={reduce ? {} : { x: -40 * dir, opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="wf-display-serif text-3xl sm:text-4xl">Ready for a quick tour?</h2>
                <p className="text-sm text-muted-foreground">Let&apos;s walk through the app. Takes about 2 minutes.</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button variant="secondary" onClick={onSkip}>Skip — I&apos;ll explore on my own</Button>
                  <Button className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]" onClick={onStartTour}>Start tour</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
