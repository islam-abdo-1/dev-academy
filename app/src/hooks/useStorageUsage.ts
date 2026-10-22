import { useCallback, useEffect, useState } from 'react';
import { getStorageUsage, type StorageUsage } from '@/lib/storage/hfWorker';
import { useAuth } from '@/lib/AuthContext';

export function useStorageUsage() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsage(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setUsage(await getStorageUsage());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage usage');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, loading, error, refresh };
}
