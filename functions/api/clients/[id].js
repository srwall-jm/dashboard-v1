// PUT    /api/clients/:id   create or update a shared client profile
// DELETE /api/clients/:id   remove it
// See server/clientProfiles.js.

import { json, isValidId, saveProfile, profilesUnavailable, PROFILE_PREFIX } from '../../../server/clientProfiles.js';

const MAX_BODY_BYTES = 20000;

const guard = (env, data, params) => {
  const reason = profilesUnavailable(env, data);
  if (reason === 'access') return json({ error: 'Shared client profiles need access to the site to be restricted first.' }, 403);
  if (reason === 'storage') return json({ error: 'Shared client profiles are not set up: the CLIENT_PROFILES storage is missing.' }, 503);
  if (!isValidId(params?.id)) return json({ error: 'Invalid client id.' }, 400);
  return null;
};

export async function onRequestPut({ request, env, data, params }) {
  const blocked = guard(env, data, params);
  if (blocked) return blocked;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'The profile is too large.' }, 413);
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'The profile is not valid JSON.' }, 400);
  }

  const result = await saveProfile(env.CLIENT_PROFILES, params.id, input, data.user.email);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ client: result.profile });
}

export async function onRequestDelete({ env, data, params }) {
  const blocked = guard(env, data, params);
  if (blocked) return blocked;
  await env.CLIENT_PROFILES.delete(`${PROFILE_PREFIX}${params.id}`);
  return json({ deleted: params.id });
}
