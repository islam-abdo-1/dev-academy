/**
 * Hook for managing user personal files
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { classifyFile } from '@/lib/storage';
import { compressStudyImage } from '@/lib/images/compress';
import {
  MAX_HF_FILE_BYTES,
  deleteStudyFile,
  uploadStudyFile,
} from '@/lib/storage/hfWorker';
import type { PersonalFile, UploadProgress } from '@/types/user';

interface UsePersonalFilesReturn {
  files: PersonalFile[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: UploadProgress | null;
  error: string | null;
  uploadFile: (file: File, options?: { onProgress?: (progress: number) => void }) => Promise<PersonalFile | null>;
  deleteFile: (id: string) => Promise<boolean>;
  updateFile: (id: string, updates: Partial<PersonalFile>) => Promise<boolean>;
  togglePublic: (id: string) => Promise<boolean>;
  createShareLink: (id: string, permission?: 'view' | 'download') => Promise<string | null>;
  refresh: () => Promise<void>;
}

export function usePersonalFiles(): UsePersonalFilesReturn {
  const { user } = useAuth();
  const [files, setFiles] = useState<PersonalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('user_personal_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load personal files');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = async (file: File, options?: { onProgress?: (progress: number) => void }): Promise<PersonalFile | null> => {
    if (!user) return null;

    setUploading(true);
    setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });
    setError(null);

    let uploadedPath: string | null = null;
    try {
      const compressed = file.type.startsWith('image/')
        ? await compressStudyImage(file)
        : null;
      const uploadFile = compressed?.file || file;

      if (uploadFile.size > MAX_HF_FILE_BYTES) {
        throw new Error('حجم الملف يتجاوز الحد الأقصى 90MB.');
      }

      setUploadProgress({ loaded: 0, total: uploadFile.size, percentage: 0 });
      const result = await uploadStudyFile(uploadFile, {
        onProgress: (progress) => {
          setUploadProgress({
            loaded: Math.round(uploadFile.size * progress / 100),
            total: uploadFile.size,
            percentage: progress,
          });
          options?.onProgress?.(progress);
        },
      });
      uploadedPath = result.path;

      const classification = classifyFile(uploadFile.name);

      const { data, error } = await supabase
        .from('user_personal_files')
        .insert({
          user_id: user.id,
          title: file.name,
          file_url: result.url,
          file_type: classification.category,
          file_size: uploadFile.size,
          mime_type: uploadFile.type || classification.mimeType,
          storage_provider: result.provider,
          storage_path: result.path,
          sha256_hash: await computeFileHash(uploadFile),
        })
        .select()
        .single();

      if (error) throw error;

      setFiles(prev => [data, ...prev]);
      setUploadProgress(null);
      return data;
    } catch (err) {
      if (uploadedPath) {
        await deleteStudyFile(uploadedPath).catch(() => undefined);
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const deleteFile = async (id: string) => {
    try {
      const file = files.find(f => f.id === id);
      if (!file) return false;

      if (file.storage_path) {
        const isCurrentWorkerPath =
          file.storage_provider === 'huggingface' &&
          user &&
          file.storage_path.startsWith(`${user.id}/`);
        if (isCurrentWorkerPath) {
          await deleteStudyFile(file.storage_path);
        } else if (file.storage_provider === 'supabase') {
          const { error: storageError } = await supabase.storage
            .from('media')
            .remove([file.storage_path]);
          if (storageError) throw storageError;
        }
      }

      const { error } = await supabase
        .from('user_personal_files')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      return false;
    }
  };

  const updateFile = async (id: string, updates: Partial<PersonalFile>) => {
    try {
      const { error } = await supabase
        .from('user_personal_files')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file');
      return false;
    }
  };

  const togglePublic = async (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return false;

    return updateFile(id, { is_public: !file.is_public });
  };

  const createShareLink = async (id: string, permission: 'view' | 'download' = 'view') => {
    try {
      const { data, error } = await supabase.rpc('create_share_link', {
        p_resource_type: 'file',
        p_resource_id: id,
        p_scope: 'all',
        p_year: null,
        p_semester: null,
        p_expires_at: null,
        p_permission: permission,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.token) throw new Error('Share token was not returned');

      return `${window.location.origin}/s/${row.token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
      return null;
    }
  };

  return {
    files,
    loading,
    uploading,
    uploadProgress,
    error,
    uploadFile,
    deleteFile,
    updateFile,
    togglePublic,
    createShareLink,
    refresh: fetchFiles,
  };
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}