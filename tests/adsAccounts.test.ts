import { describe, it, expect } from 'vitest';
import { clientKeyOf, resolveAdsAccounts } from '../adsAccounts';

const accounts = [
  { id: '111', descriptiveName: 'Client A - ES' },
  { id: '222', descriptiveName: 'Client A - UK' },
  { id: '333', descriptiveName: 'Client B' },
];

describe('clientKeyOf', () => {
  it('identifies a client by GA4 property and Search Console site', () => {
    expect(clientKeyOf('properties/1', 'sc-domain:a.com')).toBe('properties/1|sc-domain:a.com');
    expect(clientKeyOf(undefined, null)).toBe('|');
    expect(clientKeyOf('properties/1', 'sc-domain:a.com')).not.toBe(clientKeyOf('properties/1', 'sc-domain:b.com'));
  });
});

describe('resolveAdsAccounts', () => {
  it('never falls back to the whole MCC when nothing is chosen', () => {
    const r = resolveAdsAccounts(accounts, undefined);
    expect(r.accounts).toEqual([]);
    expect(r.needsChoice).toBe(true);
    expect(resolveAdsAccounts(accounts, []).needsChoice).toBe(true);
  });

  it('reads only the accounts chosen for the client', () => {
    const r = resolveAdsAccounts(accounts, ['111', '222']);
    expect(r.accounts.map(a => a.id)).toEqual(['111', '222']);
    expect(r.needsChoice).toBe(false);
    expect(r.missing).toEqual([]);
  });

  it('matches ids written with dashes', () => {
    expect(resolveAdsAccounts(accounts, ['1-1-1']).accounts.map(a => a.id)).toEqual(['111']);
  });

  it('reports chosen accounts the current login cannot see', () => {
    const r = resolveAdsAccounts(accounts, ['111', '999']);
    expect(r.accounts.map(a => a.id)).toEqual(['111']);
    expect(r.missing).toEqual(['999']);
    const none = resolveAdsAccounts(accounts, ['999']);
    expect(none.accounts).toEqual([]);
    expect(none.needsChoice).toBe(true);
  });

  it('uses a single reachable account without asking', () => {
    const r = resolveAdsAccounts([accounts[0]], undefined);
    expect(r.accounts).toEqual([accounts[0]]);
    expect(r.needsChoice).toBe(false);
  });

  it('returns nothing while accounts are not loaded', () => {
    expect(resolveAdsAccounts([], ['111'])).toEqual({ accounts: [], needsChoice: false, missing: [] });
  });
});
