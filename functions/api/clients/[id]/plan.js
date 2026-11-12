// GET   /api/clients/:id/plan   the agreed plan of a client, keyword by keyword
// PATCH /api/clients/:id/plan   set or clear the entry of one keyword
// See server/plan.js.

import { json, isValidId, profilesUnavailable } from '../../../../server/clientProfiles.js';
import { readPlan, upsertPlanItem } from '../../../../server/plan.js';

export async function onRequestGet({ env, data, params }) {
  const reason = profilesUnavailable(env, data);
  if (reason) return json({ available: false, reason, items: {} });
  if (!isValidId(params?.id)) return json({ error: 'Invalid client id.' }, 400);
  return json({ available: true, items: await readPlan(env.CLIENT_PROFILES, params.id) });
}

export async function onRequestPatch({ request, env, data, params }) {
  const reason = profilesUnavailable(env, data);
  if (reason === 'access') return json({ error: 'The shared plan needs access to the site to be restricted first.' }, 403);
  if (reason === 'storage') return json({ error: 'The shared plan is not set up: the CLIENT_PROFILES storage is missing.' }, 503);
  if (!isValidId(params?.id)) return json({ error: 'Invalid client id.' }, 400);

  const raw = await request.text();
  if (raw.length > 2000) return json({ error: 'The plan entry is too large.' }, 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'The plan entry is not valid JSON.' }, 400);
  }

  const result = await upsertPlanItem(env.CLIENT_PROFILES, params.id, input, data.user.email);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ keyword: result.keyword, item: result.item });
}
