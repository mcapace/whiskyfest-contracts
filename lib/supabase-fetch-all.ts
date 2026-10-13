/** PostgREST caps a single response at `max-rows` (1000 on Supabase); page through in chunks of this size. */
export const SUPABASE_PAGE_SIZE = 1000;

/** Hard ceiling so a runaway query cannot pull the whole table into one request. */
export const SUPABASE_FETCH_ALL_MAX_ROWS = 10_000;

type RowsResult<T> = { data: T[] | null; error: { message: string } | null };

/** Structural slice of a PostgREST builder: `.range()` returns a thenable that resolves to rows. */
type RangeQuery<T> = { range(from: number, to: number): PromiseLike<RowsResult<T>> };

/**
 * Fetch every matching row by paging with `.range()` instead of a single `.limit(N)`.
 *
 * `build` must return a fresh query each call (filters + order applied, no limit/range);
 * the page window is appended here. Rows come back in the query's order.
 */
export async function fetchAllRows<T>(
  build: () => RangeQuery<T>,
  options?: { pageSize?: number; maxRows?: number },
): Promise<T[]> {
  const pageSize = Math.max(1, options?.pageSize ?? SUPABASE_PAGE_SIZE);
  const maxRows = Math.max(pageSize, options?.maxRows ?? SUPABASE_FETCH_ALL_MAX_ROWS);
  const rows: T[] = [];
  let from = 0;
  while (from < maxRows) {
    const to = Math.min(from + pageSize, maxRows) - 1;
    const { data, error } = await build().range(from, to);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < to - from + 1) break;
    from = to + 1;
  }
  return rows;
}
