import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Search, ChevronRight } from 'lucide-react';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import PageSpinner from '../components/common/PageSpinner';
import { bookingAPI } from '../services/api';

/**
 * The one shared, org-agnostic entry point to the booking platform — a
 * visitor doesn't need an org-specific link/ID at all, they just land here
 * and pick which business they're booking with. Replaces sharing a raw
 * `/book/{orgId}` link (see BookingLinkCard, now pointing here instead).
 */
const BookingHome = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    bookingAPI.getPublicOrgList()
      .then(({ data }) => setOrgs(data || []))
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl items-center justify-center mb-4">
            <BedDouble className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Book a Room</h1>
          <p className="text-slate-500 dark:text-slate-400">Choose where you'd like to stay</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search properties..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {loading ? (
          <PageSpinner label="Loading properties..." />
        ) : filtered.length === 0 ? (
          <Card><EmptyState icon={BedDouble} title="No properties available" description="Check back soon." /></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(org => (
              <Card
                key={org.id} hover
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => navigate(`/book/${org.id}`)}
              >
                <span className="font-medium text-slate-900 dark:text-white">{org.name}</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingHome;
