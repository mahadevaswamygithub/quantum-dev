import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X, Search } from 'lucide-react';
import { geocodeSearch, reverseGeocode } from '../utils/geocode';
import Tooltip from './common/Tooltip';

/**
 * "Type a place, we'll find the coordinates" location picker - replaces
 * asking the admin for raw latitude/longitude (they usually don't know
 * them). Resolves via OpenStreetMap Nominatim (free, no API key); stores
 * only latitude/longitude on the organization, same as before.
 */
const LocationField = ({ latitude, longitude, onResolved, onClear }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | found | not_found | error
  const [resolvedLabel, setResolvedLabel] = useState('');
  const reverseLookedUp = useRef(false);

  // If this org already has coordinates (editing), show a friendly place
  // name instead of raw numbers - one reverse-geocode call on open.
  useEffect(() => {
    if (reverseLookedUp.current) return;
    if (latitude == null || latitude === '' || longitude == null || longitude === '') return;
    reverseLookedUp.current = true;
    setStatus('loading');
    reverseGeocode(latitude, longitude)
      .then(name => {
        if (name) { setResolvedLabel(name); setQuery(name); setStatus('found'); }
        else { setResolvedLabel(`${latitude}, ${longitude}`); setQuery(`${latitude}, ${longitude}`); setStatus('found'); }
      })
      .catch(() => {
        setResolvedLabel(`${latitude}, ${longitude}`);
        setQuery(`${latitude}, ${longitude}`);
        setStatus('found');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  const handleSearch = async () => {
    if (!query.trim() || status === 'loading') return;
    setStatus('loading');
    try {
      const result = await geocodeSearch(query);
      if (!result) { setStatus('not_found'); return; }
      setResolvedLabel(result.displayName);
      setStatus('found');
      onResolved(result.latitude, result.longitude);
    } catch {
      setStatus('error');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  };

  const handleClear = () => {
    setQuery('');
    setResolvedLabel('');
    setStatus('idle');
    reverseLookedUp.current = true; // don't re-trigger the reverse lookup
    onClear();
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Location (optional)</label>
        <Tooltip content="Search for a city or address - plots this organization on the dashboard map. Powered by OpenStreetMap." />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); if (status !== 'idle') setStatus('idle'); }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Bengaluru, India"
          className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={status === 'loading' || !query.trim()}
          className="flex-shrink-0 px-3 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-all disabled:opacity-50"
          title="Find coordinates"
        >
          {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
        {(query || resolvedLabel) && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 px-3 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-lg transition-all"
            title="Clear location"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {status === 'found' && (
        <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 flex items-start gap-1">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {resolvedLabel}
        </p>
      )}
      {status === 'not_found' && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">No match found - try a more specific search (e.g. add city + country).</p>
      )}
      {status === 'error' && (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">Location lookup failed - check your connection and try again.</p>
      )}
    </div>
  );
};

export default LocationField;
