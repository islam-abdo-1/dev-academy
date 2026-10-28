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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active storage accounts
    const { data: accounts, error } = await supabase
      .from('cloud_storage_accounts')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    const results = [];

    for (const account of accounts || []) {
      try {
        let quotaInfo;

        if (account.provider === 'huggingface') {
          // Check HF quota via API
          const token = Deno.env.get('HF_TOKEN');
          const response = await fetch(`https://huggingface.co/api/datasets/${account.account_email}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            quotaInfo = {
              used: data.size || 0,
              total: 50 * 1024 * 1024 * 1024, // 50GB estimated
            };
          }
        } else if (account.provider === 'cloudflare-r2') {
          // R2 doesn't have direct quota API, use estimated
          quotaInfo = { used: account.used_quota_bytes || 0, total: account.total_quota_bytes || 0 };
        } else if (account.provider === 'supabase') {
          // Supabase storage API
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );
          const { data: bucket } = await supabaseClient.storage.getBucket('media');
          quotaInfo = { used: bucket?.size || 0, total: 1024 * 1024 * 1024 };
        }

        if (quotaInfo) {
          await supabase
            .from('cloud_storage_accounts')
            .update({
              used_quota_bytes: quotaInfo.used,
              total_quota_bytes: quotaInfo.total,
              last_quota_check: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id);

          // Log quota history
          await supabase
            .from('storage_quota_logs')
            .insert({
              account_id: account.id,
              provider: account.provider,
              total_quota_bytes: quotaInfo.total,
              used_quota_bytes: quotaInfo.used,
              free_quota_bytes: quotaInfo.total - quotaInfo.used,
              usage_percentage: Math.round((quotaInfo.used / quotaInfo.total) * 100),
            });
        }

        results.push({ account_id: account.id, success: true });
      } catch (error) {
        console.error(`Quota check failed for ${account.provider}:`, error);
        results.push({ account_id: account.id, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});