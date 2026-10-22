/**
 * Hook for managing user saved lists
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { SavedList, SavedItem } from '@/types/user';

interface UseSavedListsReturn {
  lists: SavedList[];
  loading: boolean;
  error: string | null;
  createList: (name: string, description?: string) => Promise<SavedList | null>;
  updateList: (id: string, updates: Partial<SavedList>) => Promise<boolean>;
  deleteList: (id: string) => Promise<boolean>;
  getList: (id: string) => Promise<SavedList | null>;
  refresh: () => Promise<void>;
}

export function useSavedLists(): UseSavedListsReturn {
  const { user } = useAuth();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    if (!user) {
      setLists([]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('user_saved_lists')
        .select(`
          *,
          items:user_saved_items(
            id,
            content_type,
            official_material_id,
            personal_file_id,
            external_url,
            kind,
            sort_order,
            user_notes,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLists(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved lists');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    const handleChange = () => {
      fetchLists();
    };
    window.addEventListener('dev-academy:saved-items-changed', handleChange);
    return () => {
      window.removeEventListener(
        'dev-academy:saved-items-changed',
        handleChange,
      );
    };
  }, [fetchLists]);

  const createList = async (name: string, description?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('user_saved_lists')
        .insert({
          user_id: user.id,
          name,
          description,
        })
        .select()
        .single();

      if (error) throw error;

      setLists(prev => [data, ...prev]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list');
      return null;
    }
  };

  const updateList = async (id: string, updates: Partial<SavedList>) => {
    try {
      const { error } = await supabase
        .from('user_saved_lists')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setLists(prev => prev.map(list => list.id === id ? { ...list, ...updates } : list));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update list');
      return false;
    }
  };

  const deleteList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_saved_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setLists(prev => prev.filter(list => list.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list');
      return false;
    }
  };

  const getList = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('user_saved_lists')
        .select(`
          *,
          items:user_saved_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list');
      return null;
    }
  };

  return {
    lists,
    loading,
    error,
    createList,
    updateList,
    deleteList,
    getList,
    refresh: fetchLists,
  };
}