/**
 * NYWE roster rows used to be keyed only by Google Sheet row number.
 * If the sheet is sorted, that number points at a different winery.
 * Prefer the sheet CONTRACT ID (portal UUID written back). Fall back to
 * winery/billing names only when the ID cell is empty.
 */

export function normalizeRosterIdentity(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ltd|llc|inc|sa|srl|spa|soc|agricola)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rosterIdentitiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeRosterIdentity(a);
  const right = normalizeRosterIdentity(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  const leftTokens = left.split(' ').filter((w) => w.length > 2);
  const rightTokens = right.split(' ').filter((w) => w.length > 2);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;
  const rightSet = new Set(rightTokens);
  const hits = leftTokens.filter((w) => rightSet.has(w)).length;
  return hits >= 2;
}

/** UUID from the sheet CONTRACT ID cell (ignores extra text). */
export function normalizeSheetContractId(raw: string | null | undefined): string | null {
  const match = (raw ?? '').trim().toLowerCase().match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  );
  return match?.[0] ?? null;
}

export function sheetRowBelongsToContract(
  row: { sheetContractId?: string | null; wineryName?: string | null; billingCompany?: string | null },
  contract: { id: string; exhibitor_company_name?: string | null; exhibitor_legal_name?: string | null },
): boolean {
  const sheetId = normalizeSheetContractId(row.sheetContractId);
  if (sheetId) return sheetId === contract.id.toLowerCase();
  return rosterRowMatchesContract(row, contract);
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
