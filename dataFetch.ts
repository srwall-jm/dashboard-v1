// Paginated readers for GA4 and Search Console.
// Both APIs cut answers silently at a row limit, which understates totals on large sites.
// These helpers keep reading until the data is complete (or a safety cap is reached)
// and say when the result is partial, so the dashboard can warn instead of showing low figures.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isAuthExpired = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 401;

const readError = async (resp: Response, label: string): Promise<ApiError> => {
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) {
    return new ApiError(401, `${label} session expired. Reconnect ${label} in Settings.`);
  }
  return new ApiError(resp.status, data?.error?.message || `${label} request failed (status ${resp.status}).`);
};

export interface PagedResult {
  rows: any[];
  truncated: boolean; // true when the safety cap stopped the read before the end
  totalRows?: number; // GA4 only: rows available on Google's side
}

export const ga4RunReportAll = async (
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<PagedResult> => {
  const pageSize = opts.pageSize ?? 100000;
  const maxRows = opts.maxRows ?? 500000;
  const rows: any[] = [];
  let totalRows = 0;

  while (rows.length < maxRows) {
    const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, limit: pageSize, offset: rows.length }),
    });
    if (!resp.ok) throw await readError(resp, 'GA4');
    const data = await resp.json();
    if (data.error) throw new ApiError(resp.status, data.error.message);

    const page: any[] = data.rows || [];
    totalRows = Number(data.rowCount) || rows.length + page.length;
    for (const row of page) rows.push(row);
    if (page.length === 0 || rows.length >= totalRows) break;
  }

  return { rows, totalRows, truncated: rows.length < totalRows };
};

export const gscQueryAll = async (
  token: string,
  siteUrl: string,
  body: Record<string, unknown>,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<PagedResult> => {
  const pageSize = opts.pageSize ?? 25000;
  const maxRows = opts.maxRows ?? 100000;
  const rows: any[] = [];
  let lastPageFull = false;

  while (rows.length < maxRows) {
    const resp = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, rowLimit: pageSize, startRow: rows.length }),
    });
    if (!resp.ok) throw await readError(resp, 'Search Console');
    const data = await resp.json();
    if (data.error) throw new ApiError(resp.status, data.error.message);

    const page: any[] = data.rows || [];
    for (const row of page) rows.push(row);
    lastPageFull = page.length >= pageSize;
    if (!lastPageFull) break;
  }

  return { rows, truncated: lastPageFull };
};
