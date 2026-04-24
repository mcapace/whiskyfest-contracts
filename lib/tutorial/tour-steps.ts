import type { DriveStep } from 'driver.js';

type Permissions = {
  isEventsTeam?: boolean;
  isAccounting?: boolean;
  isAssistant?: boolean;
  canImpersonate?: boolean;
};

const adminSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Command center', description: 'See pipeline value, contract counts, and quick stats.', side: 'bottom', align: 'start' } },
  { element: '[data-tour="dashboard-stats"]', popover: { title: 'Quick stats', description: 'Use these cards to understand progress at a glance.', side: 'bottom' } },
  { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Recent contracts', description: 'Open any contract row for full detail + actions.', side: 'top' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Create contract', description: 'Start a new sponsor contract from here.', side: 'bottom' } },
  { element: '[data-tour="sidebar-events"]', popover: { title: 'Events review', description: 'Approve or send contracts back for changes.', side: 'right' } },
  { element: '[data-tour="sidebar-users"]', popover: { title: 'User management', description: 'Manage access and permissions for the whole team.', side: 'right' } },
  { element: '[data-tour="sidebar-accounting"]', popover: { title: 'Accounting', description: 'Review AR health and invoice lifecycle.', side: 'right' } },
  { element: '[data-tour="impersonation-menu"]', popover: { title: 'View as…', description: 'Troubleshoot as another user when needed.', side: 'left' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Cmd+K', description: 'Use command palette for quick navigation and actions.', side: 'left' } },
];

const salesSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your pipeline', description: 'These are your contracts and progress.', side: 'bottom' } },
  { element: '[data-tour="dashboard-stats"]', popover: { title: 'Status overview', description: 'Track what is in-flight vs closed.', side: 'bottom' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'New contract', description: 'Create a new sponsor contract here.', side: 'bottom' } },
  { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Contract list', description: 'Watch each one move from draft to execution.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Speed tip', description: 'Press Cmd+K to jump anywhere fast.', side: 'left' } },
];

const accountingSteps: DriveStep[] = [
  { element: '[data-tour="sidebar-accounting"]', popover: { title: 'AR dashboard', description: 'Executed contracts ready for invoicing live here.', side: 'right' } },
  { element: '[data-tour="invoice-lifecycle"]', popover: { title: 'Invoice lifecycle', description: 'Track Pending → Invoice Sent → Paid.', side: 'bottom' } },
  { element: '[data-tour="accounting-actions-bar"]', popover: { title: 'AR actions', description: 'Mark invoice sent and paid from the bottom action bar.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Quick search', description: 'Use Cmd+K to find contracts instantly.', side: 'left' } },
];

const assistantSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Scoped view', description: 'You see contracts for reps you support.', side: 'bottom' } },
  { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Track contracts', description: 'Follow status and progress for your reps.', side: 'top' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Create on behalf', description: 'Create contracts when supporting reps.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Status cues', description: 'Pills show exactly where each contract is.', side: 'bottom' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Navigate fast', description: 'Cmd+K opens universal search and actions.', side: 'left' } },
];

const defaultSteps: DriveStep[] = salesSteps;

export function getTourStepsForRole(role: string | null | undefined, permissions: Permissions): DriveStep[] {
  if (role === 'admin' || permissions.isEventsTeam) return adminSteps;
  if (permissions.isAccounting && !permissions.isEventsTeam) return accountingSteps;
  if (permissions.isAssistant) return assistantSteps;
  if (role === 'sales_rep' || role === 'sales') return salesSteps;
  return defaultSteps;
}
