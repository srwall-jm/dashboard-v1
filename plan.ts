// The plan agreed with a client, keyword by keyword. Shared through the server when the client
// is a shared client; otherwise kept in this browser. See server/plan.js.

export type PlanStatus = 'none' | 'agreed' | 'applied' | 'reverted';

export interface PlanItem {
  status: PlanStatus;
  appliedOn: string | null; // YYYY-MM-DD, set for applied and reverted
  note: string;
  doNotReduce: boolean; // a decision of the client: this keyword is never proposed for a reduction
  updatedBy?: string;
  updatedAt?: string;
}

export type Plan = Record<string, PlanItem>; // by lower-cased keyword

export const EMPTY_ITEM: PlanItem = { status: 'none', appliedOn: null, note: '', doNotReduce: false };

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  none: 'Not decided',
  agreed: 'Agreed',
  applied: 'Applied',
  reverted: 'Reverted',
};

export const planKeyOf = (keyword: string) => keyword.trim().toLowerCase();

const isEmpty = (item: PlanItem) => item.status === 'none' && !item.note.trim() && !item.doNotReduce;

// Returns the plan with one keyword changed; an entry with nothing in it is removed.
export const withPlanItem = (plan: Plan, keyword: string, item: PlanItem): Plan => {
  const next = { ...plan };
  const key = planKeyOf(keyword);
  const clean: PlanItem = {
    ...item,
    note: item.note.slice(0, 300),
    appliedOn: item.status === 'applied' || item.status === 'reverted' ? item.appliedOn : null,
  };
  if (isEmpty(clean)) delete next[key]; else next[key] = clean;
  return next;
};

export interface PlanCounts {
  agreed: number;
  applied: number;
  reverted: number;
  doNotReduce: number;
}

export const countPlan = (plan: Plan): PlanCounts => {
  const counts: PlanCounts = { agreed: 0, applied: 0, reverted: 0, doNotReduce: 0 };
  Object.values(plan).forEach(item => {
    if (item.status !== 'none') counts[item.status] += 1;
    if (item.doNotReduce) counts.doNotReduce += 1;
  });
  return counts;
};

// keyword -> note, for the keywords the client does not want reduced
export const doNotReduceMap = (plan: Plan): Map<string, string> => {
  const map = new Map<string, string>();
  Object.entries(plan).forEach(([keyword, item]) => { if (item.doNotReduce) map.set(keyword, item.note); });
  return map;
};

// ---- this browser ----

const LOCAL_KEY = 'plan_by_client';

const readAllLocal = (): Record<string, Plan> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const loadLocalPlan = (clientKey: string): Plan => readAllLocal()[clientKey] || {};

export const saveLocalPlan = (clientKey: string, plan: Plan): void => {
  try {
    const all = readAllLocal();
    if (Object.keys(plan).length === 0) delete all[clientKey]; else all[clientKey] = plan;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {
    // Storage full or blocked: the plan still applies for this session.
  }
};

// ---- shared ----

const isJson = (resp: Response) => (resp.headers.get('content-type') || '').includes('application/json');

export const fetchSharedPlan = async (clientId: string): Promise<{ available: boolean; plan: Plan }> => {
  try {
    const resp = await fetch(`/api/clients/${encodeURIComponent(clientId)}/plan`, { headers: { Accept: 'application/json' } });
    if (!resp.ok || !isJson(resp)) return { available: false, plan: {} };
    const body = await resp.json();
    return { available: body?.available === true, plan: body?.items && typeof body.items === 'object' ? body.items : {} };
  } catch {
    return { available: false, plan: {} };
  }
};

export const saveSharedPlanItem = async (clientId: string, keyword: string, item: PlanItem): Promise<void> => {
  const resp = await fetch(`/api/clients/${encodeURIComponent(clientId)}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: planKeyOf(keyword), status: item.status, appliedOn: item.appliedOn, note: item.note, doNotReduce: item.doNotReduce }),
  });
  if (!resp.ok) {
    const body = isJson(resp) ? await resp.json().catch(() => ({})) : {};
    throw new Error(body?.error || `The plan could not be saved (status ${resp.status}).`);
  }
};
