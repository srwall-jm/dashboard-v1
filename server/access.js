// Checks that a request comes through Cloudflare Access and belongs to an allowed email domain.
//
// Cloudflare Access sits in front of the site and signs every request it lets through
// (header Cf-Access-Jwt-Assertion). The functions verify that signature themselves, so a
// request that reaches them any other way is rejected.
//
// Configuration (Cloudflare Pages > Settings > Variables and Secrets):
//   ACCESS_TEAM_DOMAIN     e.g. jellyfish.cloudflareaccess.com
//   ACCESS_AUD             the "Application Audience (AUD) Tag" of the Access application
//   ALLOWED_EMAIL_DOMAINS  optional, comma separated. Default: jellyfish.com
//
// Until ACCESS_TEAM_DOMAIN and ACCESS_AUD are both set, the check is off and the app says so.

const DEFAULT_ALLOWED_DOMAINS = ['jellyfish.com'];
const KEYS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;

// teamDomain -> { keys, fetchedAt }
const keyCache = new Map();

export const normalizeTeamDomain = (value) => {
  const host = String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  if (!host) return '';
  return `https://${host.includes('.') ? host : `${host}.cloudflareaccess.com`}`;
};

// Returns null when Access is not configured.
export const accessConfig = (env) => {
  const teamDomain = normalizeTeamDomain(env?.ACCESS_TEAM_DOMAIN);
  const aud = String(env?.ACCESS_AUD || '').trim();
  if (!teamDomain || !aud) return null;
  const domains = String(env?.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  return { teamDomain, aud, allowedDomains: domains.length > 0 ? domains : DEFAULT_ALLOWED_DOMAINS };
};

const base64UrlToBytes = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const decodeJson = (part) => JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));

const loadKeys = async (teamDomain, fetchImpl, now, force) => {
  const cached = keyCache.get(teamDomain);
  if (!force && cached && now - cached.fetchedAt < KEYS_TTL_MS) return cached.keys;
  const resp = await fetchImpl(`${teamDomain}/cdn-cgi/access/certs`);
  if (!resp.ok) throw new Error(`Access keys could not be read (status ${resp.status}).`);
  const body = await resp.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  keyCache.set(teamDomain, { keys, fetchedAt: now });
  return keys;
};

const fail = (status, reason) => ({ ok: false, status, reason });

// Verifies an Access token. Returns { ok: true, email } or { ok: false, status, reason }.
export const verifyAccessToken = async (token, config, options = {}) => {
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now ?? Date.now();
  if (!token) return fail(401, 'No Cloudflare Access token on the request.');

  const parts = String(token).split('.');
  if (parts.length !== 3) return fail(401, 'Malformed Access token.');

  let header;
  let claims;
  try {
    header = decodeJson(parts[0]);
    claims = decodeJson(parts[1]);
  } catch {
    return fail(401, 'Malformed Access token.');
  }
  if (header.alg !== 'RS256' || !header.kid) return fail(401, 'Unsupported Access token.');

  let jwk;
  try {
    let keys = await loadKeys(config.teamDomain, fetchImpl, now, false);
    jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      // Keys rotate: read them again once before giving up.
      keys = await loadKeys(config.teamDomain, fetchImpl, now, true);
      jwk = keys.find((k) => k.kid === header.kid);
    }
  } catch (err) {
    return fail(503, err?.message || 'Access keys could not be read.');
  }
  if (!jwk) return fail(401, 'Access token signed with an unknown key.');

  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
  } catch {
    valid = false;
  }
  if (!valid) return fail(401, 'Access token signature is not valid.');

  const nowSeconds = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds - CLOCK_SKEW_SECONDS) return fail(401, 'Access session expired.');
  if (typeof claims.nbf === 'number' && claims.nbf > nowSeconds + CLOCK_SKEW_SECONDS) return fail(401, 'Access token not valid yet.');
  if (claims.iss !== config.teamDomain) return fail(401, 'Access token from another Cloudflare team.');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(config.aud)) return fail(401, 'Access token issued for another application.');

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) return fail(403, 'This sign-in has no email address.');
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (!config.allowedDomains.includes(domain)) return fail(403, `Only ${config.allowedDomains.map((d) => `@${d}`).join(', ')} accounts can use OneSearch.`);

  return { ok: true, email };
};

const tokenFromRequest = (request) => {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : '';
};

export const verifyAccessRequest = (request, config, options) => verifyAccessToken(tokenFromRequest(request), config, options);

// For tests.
export const clearAccessKeyCache = () => keyCache.clear();
