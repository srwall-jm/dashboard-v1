// GET    /api/clients/:id/snapshots/:snap   one saved report, with its keyword rows
// PUT    /api/clients/:id/snapshots/:snap   save (or replace) the report of a period
// DELETE /api/clients/:id/snapshots/:snap   remove it
// :snap is "{periodStart}_{periodEnd}", for example 2026-10-01_2026-10-31.

import { json, isValidId, profilesUnavailable } from '../../../../../server/clientProfiles.js';
import { MAX_SNAPSHOT_BYTES, isValidSnapshotId, saveSnapshot, snapshotKey } from '../../../../../server/snapshots.js';

const guard = (env, data, params) => {
  const reason = profilesUnavailable(env, data);
  if (reason === 'access') return json({ error: 'Saved reports need access to the site to be restricted first.' }, 403);
  if (reason === 'storage') return json({ error: 'Saved reports are not set up: the CLIENT_PROFILES storage is missing.' }, 503);
  if (!isValidId(params?.id) || !isValidSnapshotId(params?.snap)) return json({ error: 'Invalid report id.' }, 400);
  return null;
};

export async function onRequestGet({ env, data, params }) {
  const blocked = guard(env, data, params);
  if (blocked) return blocked;
  const snapshot = await env.CLIENT_PROFILES.get(snapshotKey(params.id, params.snap), 'json');
  if (!snapshot) return json({ error: 'Report not found.' }, 404);
  return json({ snapshot });
}

export async function onRequestPut({ request, env, data, params }) {
  const blocked = guard(env, data, params);
  if (blocked) return blocked;

  const raw = await request.text();
  if (raw.length > MAX_SNAPSHOT_BYTES) return json({ error: 'The report is too large.' }, 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'The report is not valid JSON.' }, 400);
  }

  const result = await saveSnapshot(env.CLIENT_PROFILES, params.id, params.snap, input, data.user.email);
  if (!result.ok) return json({ error: result.error }, 400);
  const { recommendations, ...header } = result.snapshot;
  return json({ snapshot: { ...header, keywords: recommendations.length } });
}

export async function onRequestDelete({ env, data, params }) {
  const blocked = guard(env, data, params);
  if (blocked) return blocked;
  await env.CLIENT_PROFILES.delete(snapshotKey(params.id, params.snap));
  return json({ deleted: params.snap });
}
