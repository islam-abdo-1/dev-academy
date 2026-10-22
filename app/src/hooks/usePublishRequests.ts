/**
 * Hook for managing publish requests
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { PublishRequest, PublishRequestItem } from '@/types/user';

interface UsePublishRequestsReturn {
  requests: PublishRequest[];
  loading: boolean;
  error: string | null;
  createRequest: (items: PublishRequestItem[]) => Promise<PublishRequest | null>;
  getRequest: (id: string) => Promise<PublishRequest | null>;
  cancelRequest: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePublishRequests(): UsePublishRequestsReturn {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PublishRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('publish_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load publish requests');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const createRequest = async (items: PublishRequestItem[]) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('publish_requests')
        .insert({
          user_id: user.id,
          items,
        })
        .select()
        .single();

      if (error) throw error;

      setRequests(prev => [data, ...prev]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create publish request');
      return null;
    }
  };

  const getRequest = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('publish_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request');
      return null;
    }
  };

  const cancelRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('publish_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRequests(prev => prev.filter(r => r.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request');
      return false;
    }
  };

  return {
    requests,
    loading,
    error,
    createRequest,
    getRequest,
    cancelRequest,
    refresh: () => fetchRequests(),
  };
}