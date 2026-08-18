/**
 * NYWE roster rows are keyed by Google Sheet row number.
 * If the sheet is sorted or rows are inserted, that number points at a different winery.
 * Never apply a roster patch unless the sheet winery still matches the contract.
 */

export function normalizeRosterIdentity(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|winery|estate|vineyards?|cellars?|family|wines?|spirits?|ltd|llc|inc|sa|srl|spa)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rosterIdentitiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeRosterIdentity(a);
  const right = normalizeRosterIdentity(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = left.split(' ').filter((w) => w.length > 2);
  const rightSet = new Set(right.split(' ').filter((w) => w.length > 2));
  if (leftTokens.length === 0 || rightSet.size === 0) return false;
  const hits = leftTokens.filter((w) => rightSet.has(w)).length;
  return hits >= Math.min(2, leftTokens.length, rightSet.size);
}

/** True when the Google Sheet row is still the same winery as this contract. */
export function rosterRowMatchesContract(
  row: { wineryName?: string | null; billingCompany?: string | null },
  contract: { exhibitor_company_name?: string | null; exhibitor_legal_name?: string | null },
): boolean {
  const rowNames = [row.wineryName, row.billingCompany];
  const contractNames = [contract.exhibitor_company_name, contract.exhibitor_legal_name];
  return rowNames.some((rowName) =>
    contractNames.some((contractName) => rosterIdentitiesMatch(rowName, contractName)),
  );
}
