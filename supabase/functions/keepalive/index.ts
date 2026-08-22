// Keepalive : anti-pause du projet Supabase Free (pause après 7 jours d'inactivité).
// Chaque appel exécute une VRAIE requête SQL (fn_ping_heartbeat) : c'est
// l'activité base de données qui compte, pas l'appel à l'Edge Function.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 1. Ping la table heartbeat (activité DB réelle)
    const { error: pingErr } = await supabase.rpc("fn_ping_heartbeat");
    if (pingErr) throw pingErr;

    // 2. Relit la date du dernier ping (preuve que la base répond)
    const { data, error: readErr } = await supabase
      .from("system_heartbeat")
      .select("last_ping")
      .single();
    if (readErr) throw readErr;

    return new Response(
      JSON.stringify({ status: "ok", last_ping: data?.last_ping }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ status: "error", error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
