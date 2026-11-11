// GET /api/clients/:id/snapshots
// Lists the saved reports of a client, newest first, without their keyword rows.

import { json, isValidId, profilesUnavailable } from '../../../../../server/clientProfiles.js';
import { listSnapshots } from '../../../../../server/snapshots.js';

export async function onRequestGet({ env, data, params }) {
  const reason = profilesUnavailable(env, data);
  if (reason) return json({ available: false, reason, snapshots: [] });
  if (!isValidId(params?.id)) return json({ error: 'Invalid client id.' }, 400);
  return json({ available: true, snapshots: await listSnapshots(env.CLIENT_PROFILES, params.id) });
}
