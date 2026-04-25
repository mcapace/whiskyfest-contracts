type SalesVisibilityUser = {
  role?: string | null;
  is_events_team?: boolean | null;
  is_accounting?: boolean | null;
  can_view_all_sales?: boolean | null;
  accessibleSalesRepIds?: string[] | null;
};

type SponsorVisibilityTarget = {
  sales_rep_id?: string | null;
};

export function canViewAllSales(user: SalesVisibilityUser): boolean {
  if (user.role === 'admin') return true;
  if (Boolean(user.is_events_team)) return true;
  if (Boolean(user.is_accounting)) return true;
  if (Boolean(user.can_view_all_sales)) return true;
  return false;
}

/** Uses sales_rep_id scope since contracts are linked to `sales_reps`. */
export function getVisibleContractsFilter(user: SalesVisibilityUser): {
  filter: 'all' | 'own';
  salesRepIds: string[];
} {
  if (canViewAllSales(user)) {
    return { filter: 'all', salesRepIds: [] };
  }

  const ids = [...new Set((user.accessibleSalesRepIds ?? []).filter(Boolean))];
  return { filter: 'own', salesRepIds: ids };
}

export function canViewSponsorDetails(user: SalesVisibilityUser, sponsor: SponsorVisibilityTarget): boolean {
  if (canViewAllSales(user)) return true;
  if (!sponsor.sales_rep_id) return false;
  const ids = new Set((user.accessibleSalesRepIds ?? []).filter(Boolean));
  return ids.has(sponsor.sales_rep_id);
}
