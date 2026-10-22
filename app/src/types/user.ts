/**
 * User-related TypeScript types
 */

export interface SavedList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  items?: SavedItem[];
}

export interface SavedItem {
  id: string;
  list_id: string;
  content_type: 'official' | 'personal' | 'external';
  official_material_id: string | null;
  personal_file_id: string | null;
  external_url: string | null;
  kind: 'lecture' | 'section' | 'course' | 'other' | null;
  subject_id?: string | null;
  year?: string | null;
  semester?: string | null;
  title?: string | null;
  sort_order: number;
  user_notes: string | null;
  created_at: string;
  // Populated relations
  official_material?: {
    id: string;
    title: string;
    file_type: string;
    url: string;
    subject_id?: string | null;
    chapter_id?: string | null;
  };
  personal_file?: {
    id: string;
    title: string;
    file_type: string;
    file_url: string;
    file_size: number;
  };
}

export interface PersonalFile {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  storage_provider: string;
  storage_path: string;
  sha256_hash: string | null;
  is_public: boolean;
  share_token: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PublishRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  items: PublishRequestItem[];
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export interface PublishRequestItem {
  type: 'official' | 'personal';
  id: string;
  kind: 'lecture' | 'section' | 'course' | 'other';
  target_subject_id?: string;
  target_chapter_id?: string;
  target_section_id?: string;
  title?: string;
}

export type ShareScope = 'all' | 'year' | 'term';

export interface ShareToken {
  token: string;
  resource_type:
    | 'file'
    | 'list'
    | 'course'
    | 'lecture_item'
    | 'section_item'
    | 'resource'
    | 'external';
  resource_id: string;
  permission: 'view' | 'download';
  scope: ShareScope;
  year: string | null;
  semester: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface SearchResult {
  id: string;
  title: string;
  type: 'official' | 'personal' | 'external';
  subject: string;
  chapter: string;
  lecture?: string;
  file_type: string;
  file_size?: number;
  url: string;
  preview_url?: string;
  description?: string;
}

export interface SearchFilters {
  query: string;
  type?: 'official' | 'personal' | 'external';
  subject?: string;
  chapter?: string;
  file_type?: string;
  date_from?: string;
  date_to?: string;
}