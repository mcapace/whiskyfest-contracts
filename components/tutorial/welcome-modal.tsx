'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ClipboardCheck, FilePlus2, ShieldCheck, Sparkles } from 'lucide-react';
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

  const roleCopy = useMemo(() => {
    if (roleContext.role === 'admin') {
      return {
        headline: "You're an administrator",
        body: 'You have full visibility across all contracts and can step in at any stage — approve, send, release, or troubleshoot. You can also view the app as any user to help them when questions come up.',
      };
    }
    if (roleContext.isEventsTeam) {
      return {
        headline: "You're on the events team",
        body: "You'll review and approve contracts before they go out to exhibitors. You'll also countersign on behalf of M. Shanken when exhibitors sign.",
      };
    }
    if (roleContext.isAccounting) {
      return {
        headline: "You're on the accounting team",
        body: "Once a contract is fully signed and released, it lands in your dashboard. You'll mark invoices sent and payments received — the sales rep gets notified automatically.",
      };
    }
    if (roleContext.isAssistant) {
      return {
        headline: "You're supporting a sales rep",
        body: "You'll see contracts for the reps you support. You can create and send on their behalf — anything they can do, you can do for them.",
      };
    }
    return {
      headline: "You're a sales rep",
      body: "You'll create contracts for your sponsors and track them through signing. The app handles the DocuSign flow — you just watch the status move from Draft to Executed.",
    };
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
                <p className="text-sm text-muted-foreground">Let&apos;s take a quick tour so you know your way around.</p>
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
                <h2 className="wf-display-serif text-3xl sm:text-4xl">One place for every contract</h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Create — Sales rep drafts the contract', Icon: FilePlus2 },
                    { label: 'Approve — Events team reviews and approves', Icon: ClipboardCheck },
                    { label: 'Sign — DocuSign handles signatures, status updates automatically', Icon: ShieldCheck },
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
                <p className="text-sm text-muted-foreground">From first draft to final signature, this app handles the entire WhiskyFest sponsorship contract workflow — creation, approval, signing, and accounting handoff.</p>
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
                <h2 className="wf-display-serif text-3xl sm:text-4xl">{roleCopy.headline}</h2>
                <p className="text-sm text-muted-foreground">{roleCopy.body}</p>
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
                <h2 className="wf-display-serif text-3xl sm:text-4xl">Ready for the tour?</h2>
                <p className="text-sm text-muted-foreground">Takes about two minutes. You can exit anytime with Esc and relaunch from the Help menu.</p>
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
