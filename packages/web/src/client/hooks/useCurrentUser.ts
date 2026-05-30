import { useCallback, useEffect, useState } from 'react';
import type { User } from '../types.js';

const STORAGE_KEY = 'warikan.currentUserId';

export function useCurrentUser(users: User[]) {
  const [currentUserId, setCurrentUserId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });

  useEffect(() => {
    if (users.length === 0) return;
    if (currentUserId === null || !users.some((u) => u.id === currentUserId)) {
      const first = users[0].id;
      setCurrentUserId(first);
      localStorage.setItem(STORAGE_KEY, String(first));
    }
  }, [users, currentUserId]);

  const selectUser = useCallback((id: number) => {
    setCurrentUserId(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  return { currentUserId, selectUser };
}
