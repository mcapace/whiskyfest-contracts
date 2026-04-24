import type { DriveStep } from 'driver.js';

type Permissions = {
  isEventsTeam?: boolean;
  isAccounting?: boolean;
  isAssistant?: boolean;
  canImpersonate?: boolean;
};

function getAdminSteps(canImpersonate: boolean): DriveStep[] {
  const steps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Command center', description: 'See pipeline value, contract counts, and quick stats.', side: 'bottom', align: 'start' } },
  { element: '[data-tour="dashboard-stats"]', popover: { title: 'Pipeline stats', description: 'Click stat cards to filter and focus the work queue.', side: 'bottom' } },
  { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Recent contracts', description: 'All active contracts are here. Open any row to dive in.', side: 'top' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Create contract', description: 'Start a new sponsor contract from here.', side: 'bottom' } },
  { element: '[data-tour="sidebar-events"]', popover: { title: 'Events review', description: 'Contracts awaiting approval appear here.', side: 'right' } },
  { element: '[data-tour="sidebar-users"]', popover: { title: 'User management', description: 'Manage access and permissions for the whole team.', side: 'right' } },
  { element: '[data-tour="sidebar-accounting"]', popover: { title: 'Accounting', description: 'Review AR health and invoice lifecycle.', side: 'right' } },
  ];
  if (canImpersonate) {
    steps.push({
      element: '[data-tour="impersonation-menu"]',
      popover: { title: 'View as…', description: "Use 'View as…' to troubleshoot another user's experience.", side: 'left' },
    });
  }
  steps.push(
    { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Cmd+K', description: 'Pro tip: press Cmd+K anywhere for quick actions.', side: 'left' } },
    { element: '[data-tour="command-palette-trigger"]', popover: { title: 'You are ready', description: "You're ready to run the show. Welcome aboard!", side: 'left' } },
  );
  return steps;
}

const salesSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your contracts', description: "These are your contracts - everyone you're working with is here.", side: 'bottom' } },
  { element: '[data-tour="dashboard-stats"]', popover: { title: 'Progress at a glance', description: "Quick view of what's in progress vs closed.", side: 'bottom' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'New contract', description: 'Add a sponsor, capture details, and set the rate.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Status flow', description: 'Watch Draft -> Events Review -> Sent -> Signed -> Executed.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'You are ready', description: "Questions? Ask Mike. Let's go sign some sponsors.", side: 'left' } },
];

const accountingSteps: DriveStep[] = [
  { element: '[data-tour="sidebar-accounting"]', popover: { title: 'Accounting dashboard', description: 'Every executed contract ends up here for AR processing.', side: 'right' } },
  { element: '[data-tour="invoice-lifecycle"]', popover: { title: 'Status lifecycle', description: 'Track Pending -> Invoice Sent -> Paid as you process.', side: 'bottom' } },
  { element: '[data-tour="accounting-actions-bar"]', popover: { title: 'Mark actions', description: 'Use Mark Invoice Sent / Mark Paid as each account advances.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'You are ready', description: 'Keep the money flowing. Questions? Ask Mike.', side: 'left' } },
];

const assistantSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Scoped visibility', description: "You'll see contracts for the reps you support.", side: 'bottom' } },
  { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Read + track', description: 'You can view and track status; core approvals stay with reps/events.', side: 'top' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Create on behalf', description: 'Create contracts when supporting reps.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Status cues', description: "You'll get updates as your reps' contracts move through stages.", side: 'bottom' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'You are ready', description: 'Ready to help them close deals.', side: 'left' } },
];

const defaultSteps: DriveStep[] = salesSteps;

export function getTourStepsForRole(role: string | null | undefined, permissions: Permissions): DriveStep[] {
  if (role === 'admin' || permissions.isEventsTeam) return getAdminSteps(Boolean(permissions.canImpersonate));
  if (permissions.isAccounting && !permissions.isEventsTeam) return accountingSteps;
  if (permissions.isAssistant) return assistantSteps;
  if (role === 'sales_rep' || role === 'sales') return salesSteps;
  return defaultSteps;
}
