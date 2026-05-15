import type { AuditLogEntry, ContractWithTotals } from '@/types/db';

/**
 * Comma-separated login / sales-rep emails to omit from dashboard metrics, recent contracts,
 * leaderboard, and activity feed (optional; use for sandbox logins without deleting them).
 * Example: DASHBOARD_EXCLUDED_ACCOUNT_EMAILS=test.user@mshanken.com
 */
export function dashboardExcludedAccountEmails(): Set<string> {
  const raw = process.env.DASHBOARD_EXCLUDED_ACCOUNT_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function filterContractsForDashboard(
  contracts: ContractWithTotals[],
  excludedAccountEmails: Set<string>,
): ContractWithTotals[] {
  if (excludedAccountEmails.size === 0) return contracts;
  return contracts.filter((c) => {
    const rep = c.sales_rep_email?.trim().toLowerCase();
    if (!rep) return true;
    return !excludedAccountEmails.has(rep);
  });
}

/** Drop audit rows from excluded logins so they do not appear in Recent Activity. */
export function filterAuditForDashboard(
  entries: AuditLogEntry[],
  excludedActorEmails: Set<string>,
): AuditLogEntry[] {
  if (excludedActorEmails.size === 0) return entries;
  return entries.filter((a) => {
    const e = a.actor_email?.trim().toLowerCase();
    if (!e) return true;
    return !excludedActorEmails.has(e);
  });
}
