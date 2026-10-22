import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import type { ShareToken } from '@/types/user';

export interface ShareWithResource extends ShareToken {
  id: string;
  list?: {
    id: string;
    name: string;
    item_count?: number;
  } | null;
  file?: {
    id: string;
    title: string;
    file_type: string | null;
  } | null;
  materialTitle?: string | null;
  materialFileType?: string | null;
}

interface UseSharesReturn {
  shares: ShareWithResource[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  revokeShare: (token: string) => Promise<boolean>;
}

export function useShares(): UseSharesReturn {
  const { user } = useAuth();
  const [shares, setShares] = useState<ShareWithResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setShares([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('share_tokens')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const idsFor = (type: string) =>
        rows.filter((row) => row.resource_type === type).map((row) => row.resource_id);

      const listIds = idsFor('list');
      const fileIds = idsFor('file');
      const lectureIds = idsFor('lecture_item');
      const sectionIds = idsFor('section_item');
      const resourceIds = idsFor('resource');
      const externalIds = idsFor('external');
      const courseIds = idsFor('course');

      const [lists, files, lectures, sections, resources, external, courses] =
        await Promise.all([
          listIds.length
            ? supabase.from('user_saved_lists').select('id,name').in('id', listIds)
            : Promise.resolve({ data: [], error: null }),
          fileIds.length
            ? supabase.from('user_personal_files').select('id,title,file_type').in('id', fileIds)
            : Promise.resolve({ data: [], error: null }),
          lectureIds.length
            ? supabase.from('lecture_items').select('id,title,file_type').in('id', lectureIds)
            : Promise.resolve({ data: [], error: null }),
          sectionIds.length
            ? supabase.from('section_items').select('id,title,file_type').in('id', sectionIds)
            : Promise.resolve({ data: [], error: null }),
          resourceIds.length
            ? supabase.from('resources').select('id,title,type').in('id', resourceIds)
            : Promise.resolve({ data: [], error: null }),
          externalIds.length
            ? supabase
                .from('user_saved_items')
                .select('id,title,external_url')
                .in('id', externalIds)
            : Promise.resolve({ data: [], error: null }),
          courseIds.length
            ? supabase.from('subjects').select('id,name').in('id', courseIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      const listMap = new Map((lists.data || []).map((list: any) => [list.id, list]));
      const fileMap = new Map((files.data || []).map((file: any) => [file.id, file]));
      const lectureMap = new Map((lectures.data || []).map((item: any) => [item.id, item]));
      const sectionMap = new Map((sections.data || []).map((item: any) => [item.id, item]));
      const resourceMap = new Map((resources.data || []).map((item: any) => [item.id, item]));
      const externalMap = new Map((external.data || []).map((item: any) => [item.id, item]));
      const courseMap = new Map((courses.data || []).map((item: any) => [item.id, item]));

      setShares(
        rows.map((row) => {
          const material =
            row.resource_type === 'lecture_item'
              ? lectureMap.get(row.resource_id)
              : row.resource_type === 'section_item'
                ? sectionMap.get(row.resource_id)
                : row.resource_type === 'resource'
                  ? resourceMap.get(row.resource_id)
                  : row.resource_type === 'external'
                    ? externalMap.get(row.resource_id)
                    : courseMap.get(row.resource_id);

          return {
            ...row,
            id: row.token,
            list: row.resource_type === 'list' ? listMap.get(row.resource_id) || null : null,
            file: row.resource_type === 'file' ? fileMap.get(row.resource_id) || null : null,
            materialTitle:
              material?.title ||
              material?.name ||
              material?.external_url ||
              null,
            materialFileType: material?.file_type || material?.type || null,
          };
        }) as ShareWithResource[],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener('dev-academy:shares-changed', onChanged);
    return () => window.removeEventListener('dev-academy:shares-changed', onChanged);
  }, [refresh]);

  const revokeShare = async (token: string) => {
    try {
      const { error } = await supabase.from('share_tokens').delete().eq('token', token);
      if (error) throw error;
      setShares((prev) => prev.filter((share) => share.token !== token));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
      return false;
    }
  };

  return { shares, loading, error, refresh, revokeShare };
}
