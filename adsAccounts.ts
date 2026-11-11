// Which Google Ads accounts count for each client.
//
// A manager account (MCC) usually holds the accounts of many clients. Adding
// all of them up gives a spend figure that belongs to nobody, so each client
// keeps its own list of accounts. Nothing is loaded until that list exists,
// unless the login only reaches a single account.

export interface AdsAccount {
  id: string;
  descriptiveName?: string;
}

// clientKey -> Google Ads account ids
export type PinnedAdsAccounts = Record<string, string[]>;

const STORAGE_KEY = 'google_ads_accounts_by_client';

// A client is the GA4 property plus the Search Console site in use.
export const clientKeyOf = (ga4PropertyId?: string | null, gscSiteUrl?: string | null): string =>
  `${ga4PropertyId || ''}|${gscSiteUrl || ''}`;

const cleanId = (id: string) => String(id).replace(/-/g, '');

export interface ResolvedAdsAccounts<T extends AdsAccount> {
  accounts: T[]; // accounts to read for this client
  needsChoice: boolean; // true when the user still has to pick accounts
  missing: string[]; // pinned ids the current login cannot see
}

export const resolveAdsAccounts = <T extends AdsAccount>(available: T[], pinnedIds: string[] | undefined): ResolvedAdsAccounts<T> => {
  if (available.length === 0) return { accounts: [], needsChoice: false, missing: [] };
  // A single reachable account leaves nothing to choose.
  if (available.length === 1) return { accounts: available, needsChoice: false, missing: [] };
  if (!pinnedIds || pinnedIds.length === 0) return { accounts: [], needsChoice: true, missing: [] };
  const pinned = new Set(pinnedIds.map(cleanId));
  const accounts = available.filter(a => pinned.has(cleanId(a.id)));
  const found = new Set(accounts.map(a => cleanId(a.id)));
  return {
    accounts,
    needsChoice: accounts.length === 0,
    missing: Array.from(pinned).filter(id => !found.has(id)),
  };
};

export const loadPinnedAdsAccounts = (): PinnedAdsAccounts => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: PinnedAdsAccounts = {};
    Object.entries(parsed).forEach(([key, ids]) => {
      if (Array.isArray(ids)) result[key] = ids.map(String);
    });
    return result;
  } catch {
    return {};
  }
};

export const savePinnedAdsAccounts = (pinned: PinnedAdsAccounts): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    // Storage full or blocked: the choice still applies for this session.
  }
};
