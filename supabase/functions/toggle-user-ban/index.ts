// supabase/functions/toggle-user-ban/index.ts
//
// Active ou désactive la connexion d'un compte, sans supprimer aucune donnée.
// Un admin ne peut pas désactiver son propre compte. Réservé aux administrateurs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifié');

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error('Session invalide');

    const { data: callerRoles } = await supabaseUser
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'administrateur');

    if (!callerRoles || callerRoles.length === 0) {
      throw new Error('Seul un administrateur peut modifier un compte');
    }

    const { target_user_id, ban } = await req.json();
    if (!target_user_id || typeof ban !== 'boolean') throw new Error('Paramètres manquants');

    if (target_user_id === user.id) {
      throw new Error('Impossible de désactiver ton propre compte');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // ban_duration: durée très longue = désactivé indéfiniment ; 'none' = réactivé
    const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
      ban_duration: ban ? '876000h' : 'none'
    });
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});