import { describe, it, expect, vi, afterEach } from 'vitest';
import { ga4RunReportAll, gscQueryAll, isAuthExpired, ApiError } from '../dataFetch';
import { parseLocalDate, formatDate } from '../utils';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const makeRows = (n: number) => Array.from({ length: n }, (_, i) => ({ i }));

afterEach(() => vi.unstubAllGlobals());

describe('ga4RunReportAll', () => {
  it('keeps reading pages until every row is loaded', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body); bodies.push(body);
      return jsonResponse({ rowCount: 250, rows: makeRows(Math.min(100, 250 - body.offset)) });
    }));
    const result = await ga4RunReportAll('t', 'properties/1', { metrics: [] }, { pageSize: 100 });
    expect(result.rows).toHaveLength(250);
    expect(result.truncated).toBe(false);
    expect(bodies.map(b => b.offset)).toEqual([0, 100, 200]);
  });

  it('flags a partial read when the safety cap is hit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ rowCount: 1000, rows: makeRows(100) })));
    const result = await ga4RunReportAll('t', 'properties/1', {}, { pageSize: 100, maxRows: 300 });
    expect(result.rows).toHaveLength(300);
    expect(result.truncated).toBe(true);
    expect(result.totalRows).toBe(1000);
  });

  it('handles an empty report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    const result = await ga4RunReportAll('t', 'properties/1', {});
    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('reports an expired session clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'Invalid Credentials' } }, 401)));
    const err = await ga4RunReportAll('t', 'properties/1', {}).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(isAuthExpired(err)).toBe(true);
    expect(err.message).toContain('Reconnect GA4');
  });
});

describe('gscQueryAll', () => {
  it('reads past the first page and stops on a short one', async () => {
    const starts: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body); starts.push(body.startRow);
      return jsonResponse({ rows: makeRows(body.startRow === 0 ? 50 : 20) });
    }));
    const result = await gscQueryAll('t', 'https://example.com/', { dimensions: ['date'] }, { pageSize: 50 });
    expect(result.rows).toHaveLength(70);
    expect(result.truncated).toBe(false);
    expect(starts).toEqual([0, 50]);
  });

  it('flags truncation at the cap and encodes the site URL', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ rows: makeRows(50) }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await gscQueryAll('t', 'sc-domain:example.com', {}, { pageSize: 50, maxRows: 100 });
    expect(result.rows).toHaveLength(100);
    expect(result.truncated).toBe(true);
    expect(String((fetchMock.mock.calls[0] as any[])[0])).toContain('sc-domain%3Aexample.com');
  });

  it('surfaces API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: { message: 'Quota exceeded' } }, 429)));
    await expect(gscQueryAll('t', 'x', {})).rejects.toThrow('Quota exceeded');
  });
});

describe('parseLocalDate', () => {
  it('round-trips with formatDate in any timezone', () => {
    expect(formatDate(parseLocalDate('2026-03-01'))).toBe('2026-03-01');
    expect(parseLocalDate('2026-03-01').getDate()).toBe(1);
  });
});
