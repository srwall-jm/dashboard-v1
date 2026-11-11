// Shared client profiles, stored in Cloudflare KV (binding CLIENT_PROFILES).
//
// A profile is what a team member needs to open a client without setting it up again:
// which GA4 property, Search Console site and Google Ads accounts belong to it, and its
// brand regex. It never holds Google tokens: each person still connects with their own
// Google account, so nobody sees data Google does not give them access to.
//
// Profiles are only served when access to the site is restricted (Cloudflare Access).

import { accessConfig } from './access.js';

export const PROFILE_PREFIX = 'client:';
const MAX_PROFILES = 500;
const MAX_ADS_ACCOUNTS = 200;

export const slugify = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const isValidId = (id) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 60;

// Recommendation rules adjusted for the client. Shares between 0 and 1, plus a click count.
// Ranges are enforced again by the app when it reads them (recommendations.ts).
const RULE_KEYS = [
  'minPaidClicks', 'cutNonBrandLow', 'cutNonBrandMedium', 'cutNonBrandHigh',
  'cutBrandLow', 'cutBrandMedium', 'cutBrandHigh', 'increaseStep', 'recoveryRank1', 'recoveryRank2to4',
];

const sanitizeRules = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const rules = {};
  for (const key of RULE_KEYS) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    rules[key] = key === 'minPaidClicks' ? Math.min(10000, Math.max(1, Math.round(value))) : Math.min(1, Math.max(0, value));
  }
  return Object.keys(rules).length > 0 ? rules : undefined;
};

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Keeps only the known fields, trimmed and bounded. Returns { ok, profile } or { ok: false, error }.
export const sanitizeProfile = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'The profile must be an object.' };

  const name = text(input.name, 80);
  if (!name) return { ok: false, error: 'The client needs a name.' };

  const brandRegex = text(input.brandRegex, 500);
  if (brandRegex) {
    try {
      new RegExp(brandRegex, 'i');
    } catch {
      return { ok: false, error: 'The brand regex is not a valid regular expression.' };
    }
  }

  const rawAccounts = Array.isArray(input.adsAccountIds) ? input.adsAccountIds : [];
  if (rawAccounts.length > MAX_ADS_ACCOUNTS) return { ok: false, error: `A client can have at most ${MAX_ADS_ACCOUNTS} Google Ads accounts.` };
  const adsAccountIds = [];
  for (const raw of rawAccounts) {
    const id = String(raw ?? '').replace(/-/g, '').trim();
    if (!/^\d{1,20}$/.test(id)) return { ok: false, error: 'Google Ads account IDs must be numbers.' };
    if (!adsAccountIds.includes(id)) adsAccountIds.push(id);
  }

  const adsManagerId = text(input.adsManagerId, 20).replace(/-/g, '');
  if (adsManagerId && !/^\d{1,20}$/.test(adsManagerId)) return { ok: false, error: 'The Google Ads manager ID must be a number.' };

  const recommendation = sanitizeRules(input.recommendation);

  return {
    ok: true,
    profile: {
      name,
      ga4PropertyId: text(input.ga4PropertyId, 60),
      ga4PropertyName: text(input.ga4PropertyName, 120),
      gscSiteUrl: text(input.gscSiteUrl, 300),
      adsManagerId,
      adsAccountIds,
      brandRegex,
      ...(recommendation ? { recommendation } : {}),
      ...(input.language === 'en' || input.language === 'es' ? { language: input.language } : {}),
    },
  };
};

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// Why profiles cannot be used right now, or null when they can.
export const profilesUnavailable = (env, data) => {
  if (!accessConfig(env) || !data?.user?.email) return 'access';
  if (!env?.CLIENT_PROFILES || typeof env.CLIENT_PROFILES.get !== 'function') return 'storage';
  return null;
};

export const listProfiles = async (kv) => {
  const profiles = [];
  let cursor;
  do {
    const page = await kv.list({ prefix: PROFILE_PREFIX, cursor });
    for (const key of page.keys) {
      if (profiles.length >= MAX_PROFILES) break;
      const profile = await kv.get(key.name, 'json');
      if (profile && typeof profile === 'object') profiles.push(profile);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && profiles.length < MAX_PROFILES);
  return profiles.sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export const saveProfile = async (kv, id, input, email, now = new Date()) => {
  const result = sanitizeProfile(input);
  if (!result.ok) return result;
  const profile = { id, ...result.profile, updatedBy: email, updatedAt: now.toISOString() };
  await kv.put(`${PROFILE_PREFIX}${id}`, JSON.stringify(profile));
  return { ok: true, profile };
};
