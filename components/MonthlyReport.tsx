import React, { useEffect, useMemo, useState } from 'react';
import { History, Save, Trash2, ArrowRight } from 'lucide-react';
import {
  Snapshot, SnapshotHeader, SnapshotInput, KeywordMove, diffSnapshots, snapshotIdOf,
  fetchSnapshotList, fetchSnapshot, saveSnapshotRemote, deleteSnapshotRemote,
} from '../snapshots';
import { ACTION_STYLE } from '../theme';

const int = (value: number) => Math.round(value).toLocaleString('en-US');
const SHOWN = 5;

const actionLabel = (action: KeywordMove['to']) => (action === 'ABSENT' ? 'not analysed' : ACTION_STYLE[action].label.toLowerCase());

const MoveList: React.FC<{ title: string; moves: KeywordMove[]; side: 'from' | 'to' }> = ({ title, moves, side }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-2">{title} · {moves.length}</p>
    {moves.length === 0 ? (
      <p className="text-sm text-slate-500">None.</p>
    ) : (
      <ul className="space-y-2">
        {moves.slice(0, SHOWN).map(m => (
          <li key={m.keyword} className="text-sm">
            <span className="font-semibold text-slate-900 break-words">{m.keyword}</span>
            <span className="text-slate-600"> · {side === 'to' ? `now ${actionLabel(m.to)}` : `was ${actionLabel(m.from)}`}: {m.why}.</span>
          </li>
        ))}
        {moves.length > SHOWN && <li className="text-xs font-medium text-slate-500">And {moves.length - SHOWN} more.</li>}
      </ul>
    )}
  </div>
);

// Saves the report of the period on screen for the chosen client, and shows what changed since an earlier one.
export const MonthlyReport: React.FC<{
  clientId: string | null;
  clientName?: string;
  available: boolean; // shared clients are set up (Cloudflare Access + storage)
  current: SnapshotInput | null; // null while there is nothing to save
  currencySymbol: string;
  presentation?: boolean;
  isSample?: boolean;
}> = ({ clientId, clientName, available, current, currencySymbol, presentation = false, isSample = false }) => {
  const [list, setList] = useState<SnapshotHeader[]>([]);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [compare, setCompare] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const money = (value: number) => `${currencySymbol}${int(value)}`;
  const currentId = current ? snapshotIdOf(current.periodStart, current.periodEnd) : null;
  const savedCurrent = list.find(s => s.id === currentId) || null;
  const others = list.filter(s => s.id !== currentId);

  // Reports of the chosen client.
  useEffect(() => {
    setList([]); setCompare(null); setCompareId(null); setMessage(null);
    if (!available || !clientId) return;
    let cancelled = false;
    fetchSnapshotList(clientId).then(result => { if (!cancelled) setList(result.snapshots); });
    return () => { cancelled = true; };
  }, [available, clientId]);

  // By default compare with the latest report that ended before this period starts.
  useEffect(() => {
    if (!current || others.length === 0) { setCompareId(null); return; }
    if (compareId && others.some(s => s.id === compareId)) return;
    const earlier = others.filter(s => s.periodEnd < current.periodStart);
    setCompareId((earlier[0] || others[0]).id);
  }, [list, currentId]);

  useEffect(() => {
    setCompare(null); setConfirmDelete(false);
    if (!clientId || !compareId) return;
    let cancelled = false;
    fetchSnapshot(clientId, compareId)
      .then(snapshot => { if (!cancelled) setCompare(snapshot); })
      .catch(err => { if (!cancelled) setMessage({ kind: 'error', text: err?.message || 'The earlier report could not be read.' }); });
    return () => { cancelled = true; };
  }, [clientId, compareId]);

  const diff = useMemo(() => (compare && current ? diffSnapshots(compare, current) : null), [compare, current]);

  if (isSample) return null;

  if (!available || !clientId) {
    if (presentation) return null;
    return (
      <section className="print:hidden bg-white px-6 py-4 rounded-2xl border border-dashed border-slate-300 flex items-start gap-3">
        <History size={18} className="text-slate-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Monthly report.</span>{' '}
          {available
            ? 'Save this client for the team (Settings, step 4) to keep a report each month and see what changed since the last one.'
            : 'Once shared clients are set up in Cloudflare, each month\'s report can be saved here and compared with the next.'}
        </p>
      </section>
    );
  }

  const save = async () => {
    if (!current) return;
    setBusy(true); setMessage(null);
    try {
      const header = await saveSnapshotRemote(clientId, current);
      setList(prev => [header, ...prev.filter(s => s.id !== header.id)].sort((a, b) => (a.id < b.id ? 1 : -1)));
      setMessage({ kind: 'ok', text: 'Report saved for the team.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'The report could not be saved.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!compareId) return;
    setBusy(true); setMessage(null);
    try {
      await deleteSnapshotRemote(clientId, compareId);
      setList(prev => prev.filter(s => s.id !== compareId));
      setCompareId(null);
      setMessage({ kind: 'ok', text: 'Report deleted.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'The report could not be deleted.' });
    } finally {
      setBusy(false); setConfirmDelete(false);
    }
  };

  const differentLength = compare && current && Math.abs(compare.periodDays - current.periodDays) > 3;

  return (
    <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 break-inside-avoid" aria-labelledby="monthly-report">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-600" aria-hidden="true" />
            <h3 id="monthly-report" className="jf-display text-xl text-slate-900">
              {diff ? `Since ${diff.previousPeriod}` : 'Monthly report'}
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-600 mt-1">
            {savedCurrent
              ? `This period was saved by ${savedCurrent.savedBy || 'the team'} on ${(savedCurrent.savedAt || '').slice(0, 10)}.`
              : `This period is not saved yet${clientName ? ` for ${clientName}` : ''}.`}
          </p>
        </div>
        {!presentation && (
          <div className="print:hidden flex flex-wrap items-center gap-2">
            {others.length > 0 && (
              <select
                aria-label="Compare with an earlier report"
                value={compareId || ''}
                onChange={e => setCompareId(e.target.value || null)}
                className="bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 px-3 py-2 outline-none cursor-pointer"
              >
                {others.map(s => <option key={s.id} value={s.id}>Compare with {s.periodStart} to {s.periodEnd}</option>)}
              </select>
            )}
            <button
              type="button"
              onClick={save}
              disabled={busy || !current}
              className="flex items-center gap-2 px-4 py-2 bg-jf-yellow hover:bg-jf-yellow-dark text-slate-950 rounded-lg text-xs font-semibold disabled:opacity-40"
            >
              <Save size={14} aria-hidden="true" /> {savedCurrent ? 'Update saved report' : 'Save this report'}
            </button>
          </div>
        )}
      </div>

      {message && <p className={`print:hidden text-xs font-semibold mt-3 ${message.kind === 'ok' ? 'text-[#047857]' : 'text-[#BE123C]'}`} role="status">{message.text}</p>}

      {!diff ? (
        <p className="text-sm text-slate-600 mt-4">
          {others.length === 0
            ? 'No earlier report to compare with. Save this one, and next month this block will show which keywords changed and why.'
            : 'Loading the earlier report…'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Can come down, per month</p>
              <p className="jf-figure text-3xl text-slate-900 mt-1 tabular-nums flex items-center gap-2 flex-wrap">
                {money(diff.spendCutMonthlyBefore)} <ArrowRight size={18} className="text-slate-400" aria-hidden="true" /> {money(diff.spendCutMonthlyNow)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Keywords to reduce</p>
              <p className="jf-figure text-3xl text-slate-900 mt-1 tabular-nums flex items-center gap-2">
                {diff.reduceBefore} <ArrowRight size={18} className="text-slate-400" aria-hidden="true" /> {diff.reduceNow}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Keywords to increase</p>
              <p className="jf-figure text-3xl text-slate-900 mt-1 tabular-nums flex items-center gap-2">
                {diff.increaseBefore} <ArrowRight size={18} className="text-slate-400" aria-hidden="true" /> {diff.increaseNow}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-6">
            <MoveList title="No longer on the reduce list" moves={diff.leftReduce} side="to" />
            <MoveList title="New on the reduce list" moves={diff.joinedReduce} side="from" />
            <MoveList title="No longer on the increase list" moves={diff.leftIncrease} side="to" />
            <MoveList title="New on the increase list" moves={diff.joinedIncrease} side="from" />
          </div>

          {(diff.rulesChanged || diff.modelChanged || differentLength) && (
            <p className="text-xs font-medium text-[#B45309] mt-5">
              Not a like for like comparison:
              {diff.rulesChanged ? ' the recommendation rules for this client changed between the two reports;' : ''}
              {diff.modelChanged ? ' the recommendation model was updated between the two reports;' : ''}
              {differentLength ? ` the periods are ${compare!.periodDays} and ${current!.periodDays} days long;` : ''}
              {' '}read the changes with that in mind.
            </p>
          )}

          {!presentation && (
            <div className="print:hidden mt-5 flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <button type="button" onClick={remove} disabled={busy} className="px-3 py-1.5 bg-[#B91C1C] text-white rounded-lg text-xs font-semibold disabled:opacity-40">Delete the {compare!.periodStart} report for everyone</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#B91C1C]">
                  <Trash2 size={13} aria-hidden="true" /> Delete the earlier report
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
