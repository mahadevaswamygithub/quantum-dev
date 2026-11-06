import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps a page's data fresh when *other people* change it (a guest books,
 * a colleague checks someone in). Your own actions already refetch.
 *
 *   const { refresh, refreshing, lastUpdated } = useAutoRefresh(fetchData, { interval: 30000 });
 *
 * - `refresh()`  — for a manual ⟳ button.
 * - On returning to the browser tab, refetches if the data is older than `minAge`.
 * - `interval` (ms, optional) — background refetch while the tab is visible.
 *
 * The page keeps doing its own first load; this only handles refreshes, and
 * never runs two at once.
 */
export const useAutoRefresh = (fetchFn, { interval = 0, onFocus = true, minAge = 15000 } = {}) => {
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;
  const busy = useRef(false);
  const lastRef = useRef(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      await fnRef.current?.();
      lastRef.current = Date.now();
      setLastUpdated(lastRef.current);
    } catch {
      // the page's own fetch already reports errors; keep the last good data
    } finally {
      busy.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!onFocus) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current > minAge) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [onFocus, minAge, refresh]);

  useEffect(() => {
    if (!interval) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, interval);
    return () => clearInterval(id);
  }, [interval, refresh]);

  return { refresh, refreshing, lastUpdated };
};
