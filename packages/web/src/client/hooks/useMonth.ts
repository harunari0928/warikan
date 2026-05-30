import { useCallback, useEffect, useState } from 'react';
import type { MonthSnapshot } from '../types.js';

export function useMonth(yearMonth: string) {
  const [snapshot, setSnapshot] = useState<MonthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/months/${yearMonth}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MonthSnapshot = await res.json();
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  return { snapshot, setSnapshot, loading, error, refetch: fetchMonth };
}
