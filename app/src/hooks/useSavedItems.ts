import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { SavedItem } from '@/types/user';

export interface AddSavedItemInput {
  content_type: 'official' | 'personal' | 'external';
  official_material_id?: string | null;
  personal_file_id?: string | null;
  external_url?: string | null;
  kind?: 'lecture' | 'section' | 'course' | 'other' | null;
  subject_id?: string | null;
  year?: string | null;
  semester?: string | null;
  title?: string | null;
  user_notes?: string | null;
}

interface UseSavedItemsReturn {
  items: SavedItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (listId: string, item: AddSavedItemInput) => Promise<SavedItem | null>;
  addItems: (listId: string, items: AddSavedItemInput[]) => Promise<number>;
  updateItem: (itemId: string, updates: Partial<SavedItem>) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  reorderItems: (listId: string, orderedIds: string[]) => Promise<boolean>;
}

async function enrichItems(rows: any[]): Promise<SavedItem[]> {
  if (rows.length === 0) return [];

  const lectureIds = rows
    .filter((row) => row.content_type === 'official' && row.kind !== 'section')
    .map((row) => row.official_material_id)
    .filter(Boolean);
  const sectionIds = rows
    .filter((row) => row.content_type === 'official' && row.kind === 'section')
    .map((row) => row.official_material_id)
    .filter(Boolean);
  const personalIds = rows
    .filter((row) => row.content_type === 'personal')
    .map((row) => row.personal_file_id)
    .filter(Boolean);

  const [lectures, sections, personal] = await Promise.all([
    lectureIds.length
      ? supabase
          .from('lecture_items')
          .select('id,title,file_type,url,subject_id,chapter_id,drive_file_name,drive_mime_type')
          .in('id', lectureIds)
      : Promise.resolve({ data: [], error: null }),
    sectionIds.length
      ? supabase
          .from('section_items')
          .select('id,title,file_type,url,subject_id,chapter_id,drive_file_name,drive_mime_type')
          .in('id', sectionIds)
      : Promise.resolve({ data: [], error: null }),
    personalIds.length
      ? supabase
          .from('user_personal_files')
          .select('id,title,file_type,file_url,file_size,mime_type')
          .in('id', personalIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lectureMap = new Map((lectures.data || []).map((item: any) => [item.id, item]));
  const sectionMap = new Map((sections.data || []).map((item: any) => [item.id, item]));
  const personalMap = new Map((personal.data || []).map((item: any) => [item.id, item]));

  return rows.map((row) => {
    const official =
      row.kind === 'section'
        ? sectionMap.get(row.official_material_id)
        : lectureMap.get(row.official_material_id);
    return {
      ...row,
      official_material: official
        ? {
            id: official.id,
            title: official.title,
            file_type: official.file_type,
            url: official.url,
            subject_id: official.subject_id,
            chapter_id: official.chapter_id,
          }
        : undefined,
      personal_file: personalMap.get(row.personal_file_id),
    } as SavedItem;
  });
}

export function useSavedItems(listId?: string | null): UseSavedItemsReturn {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !listId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('user_saved_items')
        .select('*')
        .eq('list_id', listId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems(await enrichItems(data || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list items');
    } finally {
      setLoading(false);
    }
  }, [user, listId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener('dev-academy:saved-items-changed', onChanged);
    return () => window.removeEventListener('dev-academy:saved-items-changed', onChanged);
  }, [refresh]);

  const addItem = async (targetListId: string, item: AddSavedItemInput) => {
    if (!user) return null;
    try {
      const { count } = await supabase
        .from('user_saved_items')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', targetListId);

      const { data, error } = await supabase
        .from('user_saved_items')
        .insert({
          list_id: targetListId,
          sort_order: count || 0,
          ...item,
        })
        .select()
        .single();

      if (error) throw error;
      const [enriched] = await enrichItems([data]);
      if (targetListId === listId) {
        setItems((prev) => [...prev, enriched]);
      }
      return enriched;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
      return null;
    }
  };

  const addItems = async (targetListId: string, newItems: AddSavedItemInput[]) => {
    if (!user || newItems.length === 0) return 0;
    try {
      const { count } = await supabase
        .from('user_saved_items')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', targetListId);

      const rows = newItems.map((item, index) => ({
        list_id: targetListId,
        sort_order: (count || 0) + index,
        ...item,
      }));

      const { data, error } = await supabase
        .from('user_saved_items')
        .insert(rows)
        .select();

      if (error) throw error;
      if (targetListId === listId) {
        const enriched = await enrichItems(data || []);
        setItems((prev) => [...prev, ...enriched]);
      }
      return data?.length || 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add items');
      return 0;
    }
  };

  const updateItem = async (itemId: string, updates: Partial<SavedItem>) => {
    try {
      const { error } = await supabase
        .from('user_saved_items')
        .update(updates)
        .eq('id', itemId);
      if (error) throw error;
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
      return false;
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('user_saved_items').delete().eq('id', itemId);
      if (error) throw error;
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
      return false;
    }
  };

  const reorderItems = async (targetListId: string, orderedIds: string[]) => {
    try {
      const updates = orderedIds.map((id, index) =>
        supabase.from('user_saved_items').update({ sort_order: index }).eq('id', id).eq('list_id', targetListId),
      );
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder items');
      return false;
    }
  };

  return {
    items,
    loading,
    error,
    refresh,
    addItem,
    addItems,
    updateItem,
    removeItem,
    reorderItems,
  };
}
