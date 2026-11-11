// Browser side of the shared client profiles (see server/clientProfiles.js).

export interface ClientProfile {
  id: string;
  name: string;
  ga4PropertyId: string;
  ga4PropertyName: string;
  gscSiteUrl: string;
  adsManagerId: string;
  adsAccountIds: string[];
  brandRegex: string;
  updatedBy?: string;
  updatedAt?: string;
}

export type ClientProfileInput = Omit<ClientProfile, 'id' | 'updatedBy' | 'updatedAt'>;

export interface ClientProfileList {
  available: boolean;
  // 'access': the site is not restricted yet. 'storage': the KV namespace is missing.
  // 'offline': no functions (local `npm run dev`).
  reason?: 'access' | 'storage' | 'offline';
  clients: ClientProfile[];
}

export const profileIdFromName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const isJson = (resp: Response) => (resp.headers.get('content-type') || '').includes('application/json');

export const fetchClientProfiles = async (): Promise<ClientProfileList> => {
  try {
    const resp = await fetch('/api/clients', { headers: { Accept: 'application/json' } });
    if (!resp.ok || !isJson(resp)) return { available: false, reason: 'offline', clients: [] };
    const body = await resp.json();
    return {
      available: body?.available === true,
      reason: body?.reason,
      clients: Array.isArray(body?.clients) ? body.clients : [],
    };
  } catch {
    return { available: false, reason: 'offline', clients: [] };
  }
};

const readError = async (resp: Response, fallback: string) => {
  const body = isJson(resp) ? await resp.json().catch(() => ({})) : {};
  return new Error(body?.error || `${fallback} (status ${resp.status}).`);
};

export const saveClientProfile = async (id: string, profile: ClientProfileInput): Promise<ClientProfile> => {
  const resp = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!resp.ok) throw await readError(resp, 'The client could not be saved');
  return (await resp.json()).client as ClientProfile;
};

export const deleteClientProfile = async (id: string): Promise<void> => {
  const resp = await fetch(`/api/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!resp.ok) throw await readError(resp, 'The client could not be deleted');
};
