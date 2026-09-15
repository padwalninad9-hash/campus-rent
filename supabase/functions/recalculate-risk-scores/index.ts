// supabase/functions/recalculate-risk-scores/index.ts
//
// Thin, callable entrypoint around the public.recompute_risk_score() SQL
// function (the actual weighted scoring logic lives there so DB triggers and
// this function never drift apart — see risk-scoring-migration.sql).
//
// Body: { user_id?: string } — recompute one user, or omit to recompute everyone.
// Two ways to call it:
//   1. As a signed-in admin (Authorization: Bearer <admin JWT>) — used by the
//      "Recalculate now" button on the admin risk dashboard.
//   2. With a shared secret (x-cron-secret: <RISK_CRON_SECRET>) — used by a
//      Supabase Cron Schedule for periodic bulk recalculation. Set this up
//      yourself: Database -> Cron Jobs -> new job -> HTTP request to this
//      function's URL with that header, on whatever schedule you want.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cronSecret = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("RISK_CRON_SECRET");
    const isCron = !!cronSecret && !!expectedCronSecret && cronSecret === expectedCronSecret;

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace("Bearer ", "");
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr || !userData?.user) throw new Error("Not authenticated");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();
      if (profileErr || !profile?.is_admin) throw new Error("Admin access required");
    }

    const { user_id } = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    let targetIds: string[];
    if (user_id) {
      targetIds = [user_id];
    } else {
      const { data: allProfiles, error: profilesErr } = await supabase.from("profiles").select("id");
      if (profilesErr) throw new Error(profilesErr.message);
      targetIds = (allProfiles || []).map((p) => p.id);
    }

    const results = [];
    for (const id of targetIds) {
      const { data, error } = await supabase.rpc("recompute_risk_score", { p_user_id: id });
      if (error) {
        results.push({ user_id: id, error: error.message });
      } else {
        results.push({ user_id: id, score: data?.score, risk_level: data?.risk_level });
      }
    }

    return new Response(JSON.stringify({ recalculated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
