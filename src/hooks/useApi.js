// hooks/useApi.js — generic data-fetching hook
import { useState, useEffect, useCallback, useRef } from "react";

export function useApi(apiFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const apiFnRef = useRef(apiFn);
  apiFnRef.current = apiFn;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFnRef.current();
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, deps); // deps controls when to re-run

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// polling variant — auto-refreshes every `ms` milliseconds
export function usePolling(apiFn, ms = 10000, deps = []) {
  const { data, loading, error, refetch } = useApi(apiFn, deps);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const id = setInterval(() => refetchRef.current(), ms);
    return () => clearInterval(id);
  }, [ms]);

  return { data, loading, error, refetch };
}