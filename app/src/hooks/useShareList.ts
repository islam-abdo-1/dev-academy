import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ShareScope } from '@/types/user';

export interface CreateShareLinkOptions {
  resourceType?:
    | 'list'
    | 'file'
    | 'course'
    | 'lecture_item'
    | 'section_item'
    | 'resource'
    | 'external';
  resourceId: string;
  scope?: ShareScope;
  year?: string | null;
  semester?: string | null;
  permission?: 'view' | 'download';
}

export interface CreatedShareLink {
  token: string;
  url: string;
}

interface UseShareListReturn {
  creating: boolean;
  error: string | null;
  created: CreatedShareLink | null;
  createShareLink: (options: CreateShareLinkOptions) => Promise<CreatedShareLink | null>;
  revokeShareLink: (token: string) => Promise<boolean>;
  reset: () => void;
}

export function useShareList(): UseShareListReturn {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShareLink | null>(null);

  const createShareLink = useCallback(async (options: CreateShareLinkOptions) => {
    setCreating(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('create_share_link', {
        p_resource_type: options.resourceType || 'list',
        p_resource_id: options.resourceId,
        p_scope: options.scope || 'all',
        p_year: options.year || null,
        p_semester: options.semester || null,
        p_expires_at: null,
        p_permission: options.permission || 'view',
      });

      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.token) throw new Error('Share link was not created');

      const result: CreatedShareLink = {
        token: row.token,
        url: `${window.location.origin}/s/${row.token}`,
      };
      setCreated(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  const revokeShareLink = useCallback(async (token: string) => {
    setError(null);
    try {
      const { error } = await supabase.from('share_tokens').delete().eq('token', token);
      if (error) throw error;
      setCreated((current) => (current?.token === token ? null : current));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setCreated(null);
  }, []);

  return { creating, error, created, createShareLink, revokeShareLink, reset };
}
