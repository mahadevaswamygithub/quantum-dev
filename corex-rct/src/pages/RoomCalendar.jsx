import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, LogIn, LogOut, Phone, UserPlus, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import RefreshButton from '../components/common/RefreshButton';
import WalkInModal from '../components/WalkInModal';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS = {
  PENDING: { label: 'Awaiting confirmation', bar: 'bg-amber-400 text-amber-950 dark:bg-amber-500' },
  CONFIRMED: { label: 'Confirmed', bar: 'bg-blue-500 text-white' },
  CHECKED_IN: { label: 'In house', bar: 'bg-green-500 text-white' },
  CHECKED_OUT: { label: 'Checked out', bar: 'bg-slate-400 text-white dark:bg-slate-600' },
};

/** Front-desk room calendar: rooms × nights, bookings as bars; click a free night to book it. */
const RoomCalendar = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [start, setStart] = useState(iso(new Date()));
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [walkIn, setWalkIn] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const today = iso(new Date());
  const manage = can('bookings.manage');

  const fetchData = useCallback(async () => {
    try { setData((await bookingAPI.getRoomCalendar({ start, days })).data); } catch { setData({ rooms: [], bookings: [] }); }
  }, [start, days]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData, { interval: 60000 });

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);
  const byRoom = useMemo(() => {
    const m = {};
    (data?.bookings || []).forEach(b => { (m[b.room_id] = m[b.room_id] || []).push(b); });
    return m;
  }, [data]);
  const occupancy = dates.map(d => (data?.bookings || []).filter(b => b.check_in <= d && b.check_out > d && b.status !== 'CHECKED_OUT').length);
  const cols = `minmax(9rem, 12rem) repeat(${days}, minmax(2.75rem, 1fr))`;

  const act = async (fn) => {
    setBusy(true);
    try { await fn(selected.id); setSelected(null); await fetchData(); } catch (err) { alert(err.response?.data?.error || 'Action failed'); } finally { setBusy(false); }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><CalendarRange className="w-6 h-6 text-green-500" /> Room calendar</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Who’s in which room each night.{manage ? ' Click a free night to book it.' : ''}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
                <button type="button" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week" className="px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><ChevronLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => setStart(today)} className="px-3 py-2 text-sm font-semibold border-x border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Today</button>
                <button type="button" onClick={() => setStart(addDays(start, 7))} aria-label="Next week" className="px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <input type="date" value={start} onChange={e => e.target.value && setStart(e.target.value)} aria-label="Start date"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
              <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Days shown"
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white">
                <option value={7}>1 week</option><option value={14}>2 weeks</option><option value={30}>30 days</option>
              </select>
              {manage && (
                <button type="button" onClick={() => setWalkIn({})} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
                  <UserPlus className="w-4 h-4" /> Walk-in
                </button>
              )}
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
            {Object.entries(STATUS).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${v.bar}`} />{v.label}</span>)}
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-red-500" />Cancel requested</span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
            {!data ? <div className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800" /> : data.rooms.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">No active rooms yet - add rooms first.</p>
            ) : (
              <div className="min-w-max">
                {/* Header: dates */}
                <div className="grid sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" style={{ gridTemplateColumns: cols }}>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sticky left-0 bg-white dark:bg-slate-800">Room</div>
                  {dates.map((d, i) => {
                    const dt = parse(d);
                    const weekend = dt.getDay() === 0 || dt.getDay() === 6;
                    return (
                      <div key={d} className={`px-1 py-1.5 text-center border-l border-slate-100 dark:border-slate-700/60 ${d === today ? 'bg-green-50 dark:bg-green-500/10' : weekend ? 'bg-slate-50 dark:bg-slate-900/40' : ''}`}>
                        <p className="text-[10px] uppercase text-slate-400">{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                        <p className={`text-sm font-bold ${d === today ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}`}>{dt.getDate()}</p>
                        <p className="text-[10px] text-slate-400">{occupancy[i]}/{data.rooms.length}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Rows: rooms */}
                {data.rooms.map(r => (
                  <div key={r.id} className="grid border-b border-slate-100 dark:border-slate-700/60 last:border-0" style={{ gridTemplateColumns: cols, gridTemplateRows: '3rem' }}>
                    <div className="px-3 flex flex-col justify-center sticky left-0 z-[5] bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700/60" style={{ gridRow: 1, gridColumn: 1 }}>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{r.property || r.room_type} · {money(r.price_per_night)}</p>
                    </div>
                    {dates.map((d, i) => {
                      const weekend = [0, 6].includes(parse(d).getDay());
                      return (
                        <button key={d} type="button" disabled={!manage || d < today} style={{ gridRow: 1, gridColumn: i + 2 }}
                          onClick={() => setWalkIn({ room: r.id, check_in: d })} aria-label={`Book ${r.name} on ${d}`}
                          className={`border-l border-slate-100 dark:border-slate-700/60 ${d === today ? 'bg-green-50/60 dark:bg-green-500/5' : weekend ? 'bg-slate-50/70 dark:bg-slate-900/30' : ''} ${manage && d >= today ? 'hover:bg-green-100/60 dark:hover:bg-green-500/10 cursor-pointer' : 'cursor-default'}`} />
                      );
                    })}
                    {(byRoom[r.id] || []).map(b => {
                      const from = Math.max(0, diff(b.check_in, start));
                      const to = Math.min(days, diff(b.check_out, start));
                      if (to <= 0 || from >= days) return null;
                      const st = STATUS[b.status] || STATUS.CONFIRMED;
                      return (
                        <button key={b.id} type="button" onClick={() => setSelected(b)} title={`${b.guest} · ${b.check_in} → ${b.check_out}`}
                          style={{ gridRow: 1, gridColumn: `${from + 2} / ${to + 2}` }}
                          className={`relative z-[3] my-2 mx-0.5 px-2 rounded-md text-left text-xs font-semibold truncate shadow-sm hover:brightness-110 ${st.bar} ${b.cancel_request ? 'ring-2 ring-red-500' : ''}`}>
                          {b.guest}{Number(b.balance_due) > 0 && <span className="opacity-80"> · {money(b.balance_due)} due</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400">CX-{String(selected.id).padStart(6, '0')} · Room {selected.room}</p>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selected.guest}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between"><dt>Stay</dt><dd className="font-medium text-slate-900 dark:text-white">{selected.check_in} → {selected.check_out}</dd></div>
              <div className="flex justify-between"><dt>Status</dt><dd>{(STATUS[selected.status] || {}).label || selected.status}</dd></div>
              <div className="flex justify-between"><dt>Guests</dt><dd>{selected.guests}</dd></div>
              <div className="flex justify-between"><dt>Balance due</dt><dd className={Number(selected.balance_due) > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{money(selected.balance_due)}</dd></div>
              {selected.cancel_request && <p className="text-red-600 dark:text-red-400 text-xs font-semibold">Guest asked to cancel - review it in Bookings.</p>}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.phone && <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200"><Phone className="w-4 h-4" />Call</a>}
              {manage && selected.status === 'CONFIRMED' && selected.check_in <= today && (
                <button type="button" disabled={busy} onClick={() => act(bookingAPI.checkInBooking)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold disabled:opacity-50"><LogIn className="w-4 h-4" />Check in</button>
              )}
              {manage && selected.status === 'CHECKED_IN' && (
                <button type="button" disabled={busy} onClick={() => act(bookingAPI.checkOutBooking)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-50"><LogOut className="w-4 h-4" />Check out</button>
              )}
            </div>
          </div>
        </div>
      )}
      <WalkInModal open={!!walkIn} preset={walkIn || {}} onClose={() => setWalkIn(null)} onSaved={fetchData} />
    </div>
  );
};

export default RoomCalendar;
