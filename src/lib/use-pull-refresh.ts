import { useCallback, useState } from 'react';

/**
 * Pull-to-refresh state that only reflects a refresh the user started by pulling.
 * Background refetches (polling, coming back to the app) stay silent — like Instagram/WhatsApp — so the spinner
 * never pops in on its own and the list never jumps.
 */
export function usePullRefresh(refetch: () => Promise<unknown> | unknown) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetch(); } finally { setRefreshing(false); }
  }, [refetch]);
  return { refreshing, onRefresh };
}
