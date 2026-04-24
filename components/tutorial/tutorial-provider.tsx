'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { driver } from 'driver.js';
import confetti from 'canvas-confetti';
import 'driver.js/dist/driver.css';
import { getTourStepsForRole } from '@/lib/tutorial/tour-steps';
import { WelcomeTutorialModal } from '@/components/tutorial/welcome-modal';

const DISMISSED_KEY = 'tour_dismissed_this_session';

export function TutorialProvider() {
  const { data: session, update } = useSession();
  const [openWelcome, setOpenWelcome] = useState(false);
  const [supportedRepNames, setSupportedRepNames] = useState<string[]>([]);
  const [liveMessage, setLiveMessage] = useState('');
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const isAssistant = Boolean(
    session?.user?.pipeline_access &&
      !session?.user?.is_events_team &&
      !session?.user?.is_accounting &&
      session?.user?.role !== 'admin',
  );

  useEffect(() => {
    if (!isAssistant) return;
    void (async () => {
      const res = await fetch('/api/sales-reps/accessible');
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.sales_reps)) {
        setSupportedRepNames((body.sales_reps as { name?: string }[]).map((x) => x.name ?? '').filter(Boolean));
      }
    })();
  }, [isAssistant]);

  const markCompleted = useCallback(async () => {
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tour_completed: true, tour_last_role: session?.user?.role ?? null }),
    });
    await update();
  }, [session?.user?.role, update]);

  const startDriverTour = useCallback(async () => {
    const allSteps = getTourStepsForRole(session?.user?.role, {
      isEventsTeam: Boolean(session?.user?.is_events_team),
      isAccounting: Boolean(session?.user?.is_accounting),
      isAssistant,
      canImpersonate: Boolean(session?.user?.can_impersonate),
    });
    const steps = allSteps.filter((s) => {
      if (!s.element || typeof s.element !== 'string') return true;
      return Boolean(document.querySelector(s.element));
    });

    if (steps.length === 0) {
      await markCompleted();
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.52,
      allowClose: true,
      popoverClass: 'wf-tour-popover',
      doneBtnText: "Let's go",
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      showButtons: ['previous', 'next', 'close'],
      stagePadding: 6,
      onHighlightStarted: (_element, step, { state }) => {
        const title = step?.popover?.title ?? 'Tour step';
        const stepIndex = (state.activeIndex ?? 0) + 1;
        setLiveMessage(`Step ${stepIndex} of ${steps.length}: ${title}`);
      },
      onDestroyed: () => {
        void markCompleted();
        if (!reducedMotion) {
          void confetti({
            particleCount: 50,
            spread: 65,
            startVelocity: 28,
            colors: ['#1f7a78', '#182d6d', '#c7a867', '#f4f1e8'],
          });
        }
        sessionStorage.setItem(DISMISSED_KEY, '1');
        returnFocusRef.current?.focus();
      },
      steps,
    });
    d.drive();
  }, [isAssistant, markCompleted, session?.user?.can_impersonate, session?.user?.is_accounting, session?.user?.is_events_team, session?.user?.role]);

  const launchWelcomeAndTour = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sessionStorage.removeItem(DISMISSED_KEY);
    setOpenWelcome(true);
  }, []);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
    const shouldAuto = !session?.user?.tour_completed_at && !wasDismissed;
    if (!session?.user?.email || !shouldAuto) return;
    const id = window.setTimeout(() => setOpenWelcome(true), 500);
    return () => window.clearTimeout(id);
  }, [session?.user?.email, session?.user?.tour_completed_at]);

  useEffect(() => {
    const onLaunch = () => launchWelcomeAndTour();
    window.addEventListener('wf:launch-tour', onLaunch);
    return () => window.removeEventListener('wf:launch-tour', onLaunch);
  }, [launchWelcomeAndTour]);

  const roleContext = useMemo(
    () => ({
      role: session?.user?.role ?? null,
      isEventsTeam: Boolean(session?.user?.is_events_team),
      isAccounting: Boolean(session?.user?.is_accounting),
      isAssistant,
      supportedRepNames,
    }),
    [isAssistant, session?.user?.is_accounting, session?.user?.is_events_team, session?.user?.role, supportedRepNames],
  );

  return (
    <>
      <WelcomeTutorialModal
        open={openWelcome}
        roleContext={roleContext}
        onSkip={() => {
          const ok = window.confirm('Skip onboarding? You can launch it any time from the Help menu.');
          if (!ok) return;
          sessionStorage.setItem(DISMISSED_KEY, '1');
          setOpenWelcome(false);
          void markCompleted();
        }}
        onStartTour={() => {
          setOpenWelcome(false);
          void startDriverTour();
        }}
      />
      <span className="sr-only" aria-live="polite">
        {liveMessage}
      </span>
    </>
  );
}
