import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { path, repo_id } = await req.json();

    if (!path || !repo_id) {
      return new Response(JSON.stringify({ error: 'path and repo_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = Deno.env.get('HF_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ error: 'HF_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create public link for the file in HF Dataset
    const response = await fetch(
      `https://huggingface.co/api/datasets/${repo_id}/permissions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: path,
          access: 'read',
          role: 'reader',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HF permission creation failed: ${error}`);
      }

      const data = await response.json();

      return new Response(JSON.stringify({
        success: true,
        publicUrl: `https://huggingface.co/datasets/${repo_id}/resolve/main/${path}`,
        permission: data,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  });