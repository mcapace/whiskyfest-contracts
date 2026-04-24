import type { DriveStep } from 'driver.js';

type Permissions = {
  isEventsTeam?: boolean;
  isAccounting?: boolean;
  isAssistant?: boolean;
  canImpersonate?: boolean;
};

function getAdminSteps(canImpersonate: boolean): DriveStep[] {
  const steps: DriveStep[] = [
    { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your command center', description: 'This is the pulse of your pipeline. Total value, contract counts, and how things are moving — all at a glance.', side: 'bottom', align: 'start' } },
    { element: '[data-tour="dashboard-stats"]', popover: { title: 'Pipeline stages', description: 'Click any stat to filter the contract list below. Useful when you want to zero in on contracts in a specific stage.', side: 'bottom' } },
    { element: '[data-tour="dashboard-contracts-table"]', popover: { title: 'Everything at your fingertips', description: 'All your active contracts live here. Click any row to open the full detail view.', side: 'top' } },
    { element: '[data-tour="new-contract-btn"]', popover: { title: 'Start a new contract', description: "Click here to create a new sponsor contract. You'll fill in signer details, booth info, and pricing.", side: 'bottom' } },
    { element: '[data-tour="sidebar-events"]', popover: { title: 'Approval queue', description: 'Contracts waiting for events team review show up here. Approve or reject with a click.', side: 'right' } },
    { element: '[data-tour="sidebar-users"]', popover: { title: 'Manage access', description: 'Add or update team members, adjust permissions, and control who can see what.', side: 'right' } },
    { element: '[data-tour="sidebar-accounting"]', popover: { title: 'The AR picture', description: 'See executed contracts ready to invoice, status of invoices sent, and payments received.', side: 'right' } },
  ];
  if (canImpersonate) {
    steps.push({
      element: '[data-tour="impersonation-menu"]',
      popover: { title: 'See what others see', description: `Use "View as..." to walk through the app as any user. Helpful when someone asks "why can't I see this?" — you can log in as them and find out.`, side: 'left' },
    });
  }
  steps.push(
    { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Quick access everywhere', description: 'Press ⌘K on Mac or Ctrl+K on Windows to open the command palette. Search contracts, jump to pages, or trigger actions without clicking through menus.', side: 'left' } },
    { popover: { title: "You're all set", description: 'That covers the basics. You can relaunch this tour anytime from the Help menu. Questions? Ping Mike.', side: 'bottom' } },
  );
  return steps;
}

const salesSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your contracts', description: "Every contract assigned to you lives here. Others can't see them — this is your view only.", side: 'bottom' } },
  { element: '[data-tour="dashboard-stats"]', popover: { title: 'Where things stand', description: "See how your contracts are tracking — how many are in draft, waiting for approval, sent, or fully signed.", side: 'bottom' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Add a sponsor', description: 'Click to create a new contract. Fill in the exhibitor signer, company, booth count, and rate. Brands can be added too.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Events team reviews', description: 'After you generate the PDF, the contract goes to the events team for approval. Once approved, you can send via DocuSign.', side: 'top' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Follow the journey', description: "Watch contracts move: Draft → Events Review → Approved → Sent → Exhibitor Signed → Fully Signed → Executed. You'll get emails at each stage.", side: 'top' } },
  { popover: { title: 'Ready to close some deals', description: 'Relaunch this tour anytime from the Help menu. Questions? Ping Mike.', side: 'bottom' } },
];

const accountingSteps: DriveStep[] = [
  { element: '[data-tour="sidebar-accounting"]', popover: { title: 'Ready to invoice', description: "Every contract that's been fully signed and released lands here. This is your queue of outstanding work.", side: 'right' } },
  { element: '[data-tour="invoice-lifecycle"]', popover: { title: 'Where the money is', description: "See what's waiting to be invoiced, what's been invoiced but unpaid, and what's closed. Total AR value up top.", side: 'bottom' } },
  { element: '[data-tour="accounting-mark-invoice-sent"]', popover: { title: 'Move it forward', description: 'When you have sent the invoice, click this button. The sales rep gets notified automatically.', side: 'top' } },
  { element: '[data-tour="accounting-mark-paid"]', popover: { title: 'Close it out', description: 'When payment comes in, mark it paid. The contract moves to "Paid" status and the sales rep is notified.', side: 'top' } },
  { popover: { title: "You're all set", description: 'Relaunch this tour anytime from the Help menu. Questions? Ping Mike.', side: 'bottom' } },
];

const assistantSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your view', description: "You're seeing contracts for the sales reps you support. Other reps' contracts are hidden - you focus on your crew.", side: 'bottom' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Creating on their behalf', description: 'When you create a new contract, the sales rep field is locked to the reps you support. You can do anything they can do on their contracts.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Follow the journey', description: 'Contracts move through: Draft → Events Review → Approved → Sent → Exhibitor Signed → Fully Signed → Executed.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Stay in the loop', description: "You'll get emails when your reps' contracts change status — no need to refresh manually.", side: 'left' } },
  { popover: { title: 'Ready to help them win', description: 'Relaunch this tour anytime from the Help menu. Questions? Ping Mike.', side: 'bottom' } },
];

const eventsSteps: DriveStep[] = [
  { element: '[data-tour="dashboard-hero"]', popover: { title: 'Your overview', description: 'All contracts in the system, organized by status. This is where you spot what needs attention.', side: 'bottom' } },
  { element: '[data-tour="sidebar-events"]', popover: { title: 'Your approval queue', description: 'Contracts waiting for review land here. Open any one to check the details before approving.', side: 'right' } },
  { element: '[data-tour="new-contract-btn"]', popover: { title: 'Make the call', description: 'Approve sends the contract forward to DocuSign. Reject sends it back to the sales rep for revisions.', side: 'bottom' } },
  { element: '[data-tour="status-badge"]', popover: { title: "You're up next", description: "When an exhibitor signs, the contract routes to Susannah Nolan for M. Shanken's countersignature. You'll get an email from DocuSign.", side: 'top' } },
  { element: '[data-tour="status-badge"]', popover: { title: 'Follow the journey', description: 'Each contract moves through statuses: Draft → Events Review → Approved → Sent → Exhibitor Signed → Fully Signed → Executed.', side: 'top' } },
  { element: '[data-tour="contract-void-btn"]', popover: { title: 'Fix mistakes', description: 'If an error slips through, you can void the DocuSign envelope before final signatures. Requires a reason and notifies everyone involved.', side: 'top' } },
  { element: '[data-tour="command-palette-trigger"]', popover: { title: 'Power user shortcut', description: '⌘K (Mac) or Ctrl+K (Windows) opens a quick search. Find any contract or jump to any page instantly.', side: 'left' } },
  { popover: { title: 'Ready to go', description: 'You can relaunch this tour anytime from the Help menu. Questions? Ping Mike.', side: 'bottom' } },
];

const defaultSteps: DriveStep[] = salesSteps;

export function getTourStepsForRole(role: string | null | undefined, permissions: Permissions): DriveStep[] {
  if (role === 'admin') return getAdminSteps(Boolean(permissions.canImpersonate));
  if (permissions.isEventsTeam) return eventsSteps;
  if (permissions.isAccounting && !permissions.isEventsTeam) return accountingSteps;
  if (permissions.isAssistant) return assistantSteps;
  if (role === 'sales_rep' || role === 'sales') return salesSteps;
  return defaultSteps;
}
