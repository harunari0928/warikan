import { useCallback, useEffect, useState } from 'react';
import type { User } from '../types.js';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    const data: User[] = res.ok ? await res.json() : [];
    setUsers(data);
    setLoaded(true);
    return data;
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, setUsers, loaded, fetchUsers };
}
