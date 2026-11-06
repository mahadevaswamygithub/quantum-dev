import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, MessageSquare, Star } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import RefreshButton from '../components/common/RefreshButton';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';
import { formatDate } from '../components/guest/guestUtils';
import Stars from '../components/common/Stars';

const ReviewCard = ({ review, canReply, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await bookingAPI.replyToReview(review.id, text);
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the reply.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Stars value={review.rating} />
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{review.guest}<span className="font-normal text-slate-500"> · {review.room} · {formatDate(review.check_in)} – {formatDate(review.check_out)}</span></p>
        </div>
        <span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</span>
      </div>
      {review.comment
        ? <p className="mt-3 text-slate-700 dark:text-slate-200 whitespace-pre-line">{review.comment}</p>
        : <p className="mt-3 text-sm italic text-slate-400">No written comment.</p>}
      {review.private_feedback && (
        <div className="mt-3 flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-900 dark:text-amber-200">
          <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span><b>Private feedback</b> (only your team sees this): {review.private_feedback}</span>
        </div>
      )}
      {!editing && review.reply && (
        <div className="mt-3 pl-3 border-l-2 border-green-500">
          <p className="text-xs font-semibold text-green-700 dark:text-green-400">Your reply{review.replied_by_name ? ` · ${review.replied_by_name}` : ''}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{review.reply}</p>
        </div>
      )}
      {canReply && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400">
          <MessageSquare className="w-4 h-4" /> {review.reply ? 'Edit reply' : 'Reply publicly'}
        </button>
      )}
      {editing && (
        <div className="mt-3 space-y-2">
          <textarea rows={3} value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="Thank the guest, or address their comment. This is shown publicly."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Post reply
            </button>
            <button type="button" onClick={() => { setEditing(false); setText(review.reply || ''); }} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
};

/** Staff: guests' ratings, comments and private feedback for this property, with public replies. */
const ReviewsPage = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const params = filter === 'unreplied' ? { unreplied: 1 } : filter === 'all' ? undefined : { rating: filter };
    const { data: d } = await bookingAPI.getStaffReviews(params);
    setData(d);
  }, [filter]);
  useEffect(() => { load().catch(() => setData({ reviews: [], count: 0, average: null })); }, [load]);
  const live = useAutoRefresh(load);

  const filters = [['all', 'All'], ['unreplied', 'Needs reply'], ['5', '5★'], ['4', '4★'], ['3', '3★'], ['2', '2★'], ['1', '1★']];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reviews</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                {data?.average ? <><Stars value={data.average} /> <b className="text-slate-900 dark:text-white">{data.average}</b> from {data.count} review{data.count === 1 ? '' : 's'}</> : 'What guests say after their stay.'}
              </p>
            </div>
            <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {filters.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium border ${
                  filter === id ? 'bg-green-600 border-green-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}>{label}</button>
            ))}
          </div>
          {!data ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : data.reviews.length === 0 ? (
            <Card><EmptyState icon={Star} title="No reviews here yet" description="Guests can rate their stay after they check out." /></Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.reviews.map(r => <ReviewCard key={r.id} review={r} canReply={can('reviews.reply')} onSaved={live.refresh} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReviewsPage;
