'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { getTourStepsForRole } from '@/lib/tutorial/tour-steps';
import { WelcomeTutorialModal } from '@/components/tutorial/welcome-modal';

const DISMISSED_KEY = 'tour_dismissed_this_session';

export function TutorialProvider() {
  const { data: session, update } = useSession();
  const [openWelcome, setOpenWelcome] = useState(false);
  const [supportedRepNames, setSupportedRepNames] = useState<string[]>([]);

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

    const d = driver({
      showProgress: true,
      animate: true,
      overlayOpacity: 0.52,
      allowClose: true,
      doneBtnText: "Let's go",
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      stagePadding: 6,
      onDestroyed: () => {
        void markCompleted();
        sessionStorage.setItem(DISMISSED_KEY, '1');
      },
      steps,
    });
    d.drive();
  }, [isAssistant, markCompleted, session?.user?.can_impersonate, session?.user?.is_accounting, session?.user?.is_events_team, session?.user?.role]);

  const launchWelcomeAndTour = useCallback(() => {
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
    <WelcomeTutorialModal
      open={openWelcome}
      roleContext={roleContext}
      onSkip={() => {
        sessionStorage.setItem(DISMISSED_KEY, '1');
        setOpenWelcome(false);
        void markCompleted();
      }}
      onStartTour={() => {
        setOpenWelcome(false);
        void startDriverTour();
      }}
    />
  );
}
