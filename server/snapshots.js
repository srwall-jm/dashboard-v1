// Saved reports ("snapshots") per client, in the same Cloudflare KV namespace as the profiles.
//
// A snapshot freezes what the recommendations said for a period, so next month can be
// compared with it. The browser computes it; the server only checks and stores it.
// Keys: snapshot:{clientId}:{periodStart}_{periodEnd}

import { isValidId } from './clientProfiles.js';

export const SNAPSHOT_PREFIX = 'snapshot:';
export const MAX_SNAPSHOT_BYTES = 600000;
const MAX_ROWS = 1500;
const MAX_LISTED = 36;
const ACTIONS = ['REDUCE', 'HOLD', 'INCREASE', 'NO_DATA'];
const PRESSURES = ['low', 'medium', 'high', 'unknown'];

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
export const snapshotIdOf = (periodStart, periodEnd) => `${periodStart}_${periodEnd}`;
export const isValidSnapshotId = (id) => typeof id === 'string' && /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(id);
export const snapshotKey = (clientId, snapshotId) => `${SNAPSHOT_PREFIX}${clientId}:${snapshotId}`;

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

const SUMMARY_FIELDS = ['spendAnalysed', 'spendCut', 'spendCutMonthly', 'spendToIncrease', 'netChange', 'extraConversions', 'judgedKeywords'];
const range = (value) => ({ low: num(value?.low), high: num(value?.high) });

// Keeps only the known fields. Returns { ok, snapshot } or { ok: false, error }.
export const sanitizeSnapshot = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'The report must be an object.' };
  if (!isDate(input.periodStart) || !isDate(input.periodEnd) || input.periodStart > input.periodEnd) {
    return { ok: false, error: 'The report needs a valid period.' };
  }
  const rows = Array.isArray(input.recommendations) ? input.recommendations : null;
  if (!rows) return { ok: false, error: 'The report has no recommendations.' };
  if (rows.length > MAX_ROWS) return { ok: false, error: `A report can hold at most ${MAX_ROWS} keywords.` };

  const recommendations = [];
  for (const row of rows) {
    const keyword = text(row?.keyword, 200).trim();
    if (!keyword || !ACTIONS.includes(row?.action)) return { ok: false, error: 'A keyword in the report is not valid.' };
    recommendations.push({
      keyword,
      action: row.action,
      isBrand: row.isBrand === true,
      currentSpend: num(row.currentSpend),
      suggestedSpend: num(row.suggestedSpend),
      organicRank: typeof row.organicRank === 'number' && Number.isFinite(row.organicRank) ? row.organicRank : null,
      pressure: PRESSURES.includes(row.pressure) ? row.pressure : 'unknown',
    });
  }

  const summary = {};
  for (const field of SUMMARY_FIELDS) summary[field] = num(input.summary?.[field]);
  summary.clicksAtRisk = range(input.summary?.clicksAtRisk);
  summary.clicksRecovered = range(input.summary?.clicksRecovered);
  summary.counts = {};
  for (const action of ACTIONS) summary.counts[action] = Math.max(0, Math.round(num(input.summary?.counts?.[action])));

  const warnings = (Array.isArray(input.warnings) ? input.warnings : []).slice(0, 20).map((w) => text(w, 400)).filter(Boolean);

  return {
    ok: true,
    snapshot: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      periodDays: Math.max(1, Math.round(num(input.periodDays)) || 1),
      currencySymbol: text(input.currencySymbol, 8),
      modelVersion: text(input.modelVersion, 40),
      rules: input.rules && typeof input.rules === 'object' && !Array.isArray(input.rules)
        ? Object.fromEntries(Object.entries(input.rules).filter(([k, v]) => /^[a-zA-Z0-9]{1,40}$/.test(k) && typeof v === 'number' && Number.isFinite(v)).slice(0, 20))
        : {},
      summary,
      recommendations,
      warnings,
    },
  };
};

// What a list shows: everything but the keyword rows.
export const snapshotHeader = (snapshot) => {
  const { recommendations, ...header } = snapshot;
  return { ...header, keywords: Array.isArray(recommendations) ? recommendations.length : 0 };
};

export const listSnapshots = async (kv, clientId) => {
  const page = await kv.list({ prefix: `${SNAPSHOT_PREFIX}${clientId}:` });
  const names = page.keys.map((k) => k.name).sort().reverse().slice(0, MAX_LISTED);
  const headers = [];
  for (const name of names) {
    const snapshot = await kv.get(name, 'json');
    if (snapshot && typeof snapshot === 'object') headers.push(snapshotHeader(snapshot));
  }
  return headers;
};

export const saveSnapshot = async (kv, clientId, snapshotId, input, email, now = new Date()) => {
  if (!isValidId(clientId) || !isValidSnapshotId(snapshotId)) return { ok: false, error: 'Invalid report id.' };
  const result = sanitizeSnapshot(input);
  if (!result.ok) return result;
  if (snapshotIdOf(result.snapshot.periodStart, result.snapshot.periodEnd) !== snapshotId) {
    return { ok: false, error: 'The report id does not match its period.' };
  }
  const snapshot = { id: snapshotId, clientId, ...result.snapshot, savedBy: email, savedAt: now.toISOString() };
  await kv.put(snapshotKey(clientId, snapshotId), JSON.stringify(snapshot));
  return { ok: true, snapshot };
};
