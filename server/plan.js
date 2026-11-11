// The plan agreed with a client, keyword by keyword: what was agreed, when it was applied,
// a note, and whether the keyword must never be reduced. Stored as one document per client
// in the same KV namespace as the profiles, under plan:{clientId}.

export const PLAN_PREFIX = 'plan:';
export const PLAN_STATUSES = ['none', 'agreed', 'applied', 'reverted'];
const MAX_ITEMS = 2000;

export const planKey = (clientId) => `${PLAN_PREFIX}${clientId}`;

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Returns { ok, keyword, item } or { ok: false, error }. item is null when nothing is left to keep.
export const sanitizePlanItem = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'The plan entry must be an object.' };
  const keyword = typeof input.keyword === 'string' ? input.keyword.trim().toLowerCase().slice(0, 200) : '';
  if (!keyword) return { ok: false, error: 'The plan entry needs a keyword.' };
  const status = PLAN_STATUSES.includes(input.status) ? input.status : 'none';
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 300) : '';
  const doNotReduce = input.doNotReduce === true;
  let appliedOn = null;
  if (status === 'applied' || status === 'reverted') {
    if (!isDate(input.appliedOn)) return { ok: false, error: 'An applied change needs the date it was applied.' };
    appliedOn = input.appliedOn;
  }
  if (status === 'none' && !note && !doNotReduce) return { ok: true, keyword, item: null };
  return { ok: true, keyword, item: { status, appliedOn, note, doNotReduce } };
};

export const readPlan = async (kv, clientId) => {
  const doc = await kv.get(planKey(clientId), 'json');
  return doc && typeof doc === 'object' && doc.items && typeof doc.items === 'object' ? doc.items : {};
};

// Reads, changes one keyword and writes back. Two people editing different keywords at the same
// moment can still lose one change; the window is one request long.
export const upsertPlanItem = async (kv, clientId, input, email, now = new Date()) => {
  const result = sanitizePlanItem(input);
  if (!result.ok) return result;
  const items = await readPlan(kv, clientId);
  if (result.item) {
    if (!(result.keyword in items) && Object.keys(items).length >= MAX_ITEMS) {
      return { ok: false, error: `A plan can hold at most ${MAX_ITEMS} keywords.` };
    }
    items[result.keyword] = { ...result.item, updatedBy: email, updatedAt: now.toISOString() };
  } else {
    delete items[result.keyword];
  }
  await kv.put(planKey(clientId), JSON.stringify({ items }));
  return { ok: true, keyword: result.keyword, item: items[result.keyword] || null };
};
