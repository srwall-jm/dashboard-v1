// GET /api/clients
// Lists the shared client profiles. See server/clientProfiles.js.

import { json, listProfiles, profilesUnavailable } from '../../../server/clientProfiles.js';

export async function onRequestGet({ env, data }) {
  const reason = profilesUnavailable(env, data);
  // Answered with 200 so the app can simply hide the client switcher.
  if (reason) return json({ available: false, reason, clients: [] });
  return json({ available: true, clients: await listProfiles(env.CLIENT_PROFILES) });
}
