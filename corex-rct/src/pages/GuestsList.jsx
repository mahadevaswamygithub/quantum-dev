import React, { useCallback, useEffect, useState } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/common/RefreshButton';
import { ChevronDown, ChevronRight, Loader2, Mail, Phone, Search, Users as UsersIcon } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { bookingAPI } from '../services/api';
import { formatDate, formatMoney } from '../components/guest/guestUtils';

const STATUS_TONE = { PENDING: 'amber', CONFIRMED: 'blue', CHECKED_IN: 'green', CHECKED_OUT: 'slate', CANCELLED: 'red' };
const STATUS_LABEL = { PENDING: 'Pending', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled' };

/** One guest's stays *with this property* (lazy-loaded when the row opens). */
const GuestStays = ({ customerId }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    bookingAPI.getBookings({ customer: customerId }).then(({ data }) => setRows(data || [])).catch(() => setRows([]));
  }, [customerId]);
  if (!rows) return <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
          <th className="py-2 pr-4 font-medium">Room</th><th className="py-2 pr-4 font-medium">Dates</th>
          <th className="py-2 pr-4 font-medium">Status</th><th className="py-2 font-medium text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
        {rows.map(b => (
          <tr key={b.id}>
            <td className="py-2 pr-4 text-slate-900 dark:text-white">{b.room_detail?.name}<span className="text-slate-400"> · {b.property_name}</span></td>
            <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{formatDate(b.check_in)} → {formatDate(b.check_out)}</td>
            <td className="py-2 pr-4"><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status] || b.status}</Badge></td>
            <td className="py-2 text-right text-slate-900 dark:text-white tabular-nums">{formatMoney(b.total_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * Property staff's guest list - everyone who has booked *with this
 * property*, built from its own reservations. Guest accounts belong to the
 * platform: staff can't edit them or see a guest's stays elsewhere.
 */
const GuestsList = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guests, setGuests] = useState(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback((q) => {
    return bookingAPI.getGuests(q ? { search: q } : undefined)
      .then(({ data }) => setGuests(data || []))
      .catch(() => setGuests([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, load]);
  const live = useAutoRefresh(() => load(search.trim()), { interval: 60000 });

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guests</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Everyone who has booked with {user?.organization_name || 'you'}, with their contact details from those bookings.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
            </label>
            <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          <Card className="overflow-hidden">
            {!guests ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : guests.length === 0 ? (
              <EmptyState icon={UsersIcon} title={search ? 'No guests match your search' : 'No guests yet'}
                description={search ? 'Try a different name, email or phone.' : 'Guests appear here after their first booking with you.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Guest</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold text-right">Bookings</th>
                      <th className="px-4 py-3 font-semibold text-right">Completed stays</th>
                      <th className="px-4 py-3 font-semibold text-right">Upcoming</th>
                      <th className="px-4 py-3 font-semibold text-right">Total spent</th>
                      <th className="px-4 py-3 font-semibold">Last check-in</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {guests.map(g => {
                      const isOpen = open === g.customer;
                      return (
                        <React.Fragment key={g.customer}>
                          <tr onClick={() => setOpen(isOpen ? null : g.customer)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">{g.name || 'Guest'}</p>
                                  <a href={`mailto:${g.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:underline truncate">
                                    <Mail className="w-3 h-3" />{g.email}
                                  </a>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {g.phone
                                ? <a href={`tel:${g.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:underline"><Phone className="w-3.5 h-3.5" />{g.phone}</a>
                                : <span className="text-slate-400">-</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-white">{g.bookings}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-white">{g.stays}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{g.upcoming ? <Badge tone="green">{g.upcoming}</Badge> : <span className="text-slate-400">0</span>}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-white">{formatMoney(g.total_spent)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{g.last_check_in ? formatDate(g.last_check_in) : '-'}</td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                              <td colSpan={7} className="px-10 py-2"><GuestStays customerId={g.customer} /></td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};

export default GuestsList;
