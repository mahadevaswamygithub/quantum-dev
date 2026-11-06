import { useState, useEffect } from 'react';
import { bookingAPI } from '../services/api';

/** Fetches {id, name, org_type} for a booking-site org via the public,
 * unauthenticated endpoint — shared by every customer-portal page that
 * needs to show "Booking for: {org name}" before/after login. */
export const useOrgInfo = (orgId) => {
  const [org, setOrg] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    if (!orgId) { setOrg(null); setLoading(false); return undefined; }
    setLoading(true);
    bookingAPI.getPublicOrgInfo(orgId)
      .then(({ data }) => { if (!cancelled) setOrg(data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  return { org, loading, notFound };
};
