import { supabase } from '@/lib/supabase';

export type PublishReviewAction = 'approve' | 'reject' | 'needs_changes';

export async function reviewPublishRequest(
  requestId: string,
  action: PublishReviewAction,
  notes?: string,
) {
  const { data, error } = await supabase.rpc('review_publish_request', {
    p_request_id: requestId,
    p_action: action,
    p_notes: notes?.trim() || null,
  });

  if (error) throw error;
  return data;
}
