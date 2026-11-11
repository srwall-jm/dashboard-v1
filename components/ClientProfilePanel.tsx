import React, { useEffect, useState } from 'react';
import { Users, Save, Trash2 } from 'lucide-react';
import { ClientProfile, ClientProfileInput, profileIdFromName } from '../clientProfiles';

// Settings block to save the current setup as a client the whole team can open.
export const ClientProfilePanel: React.FC<{
  available: boolean;
  unavailableReason?: 'access' | 'storage' | 'offline';
  profiles: ClientProfile[];
  activeProfile: ClientProfile | null;
  current: ClientProfileInput; // what would be saved right now
  onSave: (id: string, profile: ClientProfileInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelect: (id: string | null) => void;
}> = ({ available, unavailableReason, profiles, activeProfile, current, onSave, onDelete, onSelect }) => {
  const [name, setName] = useState(activeProfile?.name || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(activeProfile?.name || '');
    setConfirmDelete(false);
  }, [activeProfile?.id]);

  if (!available) {
    return (
      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2 text-slate-900">
          <Users size={16} />
          <h3 className="text-sm font-black uppercase tracking-widest">Shared clients</h3>
        </div>
        <p className="text-xs text-slate-500">
          {unavailableReason === 'storage'
            ? 'Not set up yet: the CLIENT_PROFILES storage is missing in Cloudflare (README, "Shared client profiles").'
            : unavailableReason === 'access'
              ? 'Available once access to the site is restricted with Cloudflare Access (README, "Restricting access").'
              : 'Not available in local development. Client settings are saved in this browser.'}
        </p>
      </section>
    );
  }

  const trimmed = name.trim();
  const id = activeProfile && trimmed === activeProfile.name ? activeProfile.id : profileIdFromName(trimmed);
  const existing = profiles.find(p => p.id === id) || null;
  const isUpdate = Boolean(existing);
  const missing = [
    !current.ga4PropertyId && 'GA4 property',
    !current.gscSiteUrl && 'Search Console site',
  ].filter(Boolean) as string[];

  const save = async () => {
    if (!trimmed || !id) return;
    setBusy(true);
    setMessage(null);
    try {
      await onSave(id, { ...current, name: trimmed });
      setMessage({ kind: 'ok', text: isUpdate ? 'Client updated for the whole team.' : 'Client saved for the whole team.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'The client could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activeProfile) return;
    setBusy(true);
    setMessage(null);
    try {
      await onDelete(activeProfile.id);
      setMessage({ kind: 'ok', text: 'Client deleted.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'The client could not be deleted.' });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1 text-slate-900">
        <Users size={16} />
        <h3 className="text-sm font-black uppercase tracking-widest">Shared clients</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Save the setup below (GA4 property, Search Console site, Google Ads accounts, brand regex) as a client the whole team can open.
        Each person still connects with their own Google account.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={activeProfile?.id || ''}
          onChange={e => onSelect(e.target.value || null)}
          className="sm:w-1/2 bg-slate-50 border border-slate-200 rounded-xl text-xs p-3 outline-none cursor-pointer"
          aria-label="Open a saved client"
        >
          <option value="">{profiles.length === 0 ? 'No clients saved yet' : 'Open a saved client...'}</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setMessage(null); }}
          placeholder="Client name"
          maxLength={80}
          className="sm:w-1/2 bg-slate-50 border border-slate-200 rounded-xl text-xs p-3 outline-none focus:ring-2 ring-amber-400"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={save}
          disabled={busy || !trimmed || !id}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          <Save size={12} /> {isUpdate ? `Update "${existing!.name}"` : 'Save as new client'}
        </button>
        {activeProfile && (confirmDelete ? (
          <>
            <button onClick={remove} disabled={busy} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
              Delete for everyone
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} disabled={busy} className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <Trash2 size={12} /> Delete
          </button>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="text-[11px] text-amber-700 font-bold mt-3">Not chosen yet, so it will be saved empty: {missing.join(', ')}.</p>
      )}
      {message && (
        <p className={`text-[11px] font-bold mt-3 ${message.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{message.text}</p>
      )}
      {activeProfile?.updatedBy && (
        <p className="text-[10px] text-slate-400 mt-3">
          Last saved by {activeProfile.updatedBy}{activeProfile.updatedAt ? ` on ${activeProfile.updatedAt.slice(0, 10)}` : ''}.
        </p>
      )}
    </section>
  );
};
