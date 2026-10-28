import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadJob {
  id: string;
  file_id: string;
  user_id: string;
  target_provider: string;
  target_account_id?: string;
  status: string;
  progress: number;
  error?: string;
  retry_count: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending jobs
    const { data: jobs, error } = await supabase
      .from('upload_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;

    for (const job of jobs) {
      try {
        // Mark as processing
        await supabase
          .from('upload_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Get file info
        const { data: file, error: fileError } = await supabase
          .from('user_personal_files')
          .select('*')
          .eq('id', job.file_id)
          .single();

        if (fileError || !file) {
          throw new Error('File not found');
        }

        // Update progress
        await supabase
          .from('upload_queue')
          .update({ progress: 50, updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Simulate upload - in production, actual upload would happen here
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mark as completed
        await supabase
          .from('upload_queue')
          .update({
            status: 'completed',
            progress: 100,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Record stats
        const statResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/record-upload-stat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              provider: job.target_provider,
              bytes: file.file_size || 0,
              success: true,
              durationMs: 1000
            })
          });

        processed++;
      } catch (error) {
        // Handle failure
        const retryCount = (job as any).retry_count + 1;
        if (retryCount >= 3) {
          await supabase
            .from('upload_queue')
            .update({
              status: 'dead_letter',
              error: error.message,
              retry_count: retryCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        } else {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 300000);
          await supabase
            .from('upload_queue')
            .update({
              status: 'pending',
              error: error.message,
              retry_count: retryCount,
              next_retry_at: new Date(Date.now() + delay).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);
        }
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});