// supabase/functions/list-users/index.ts
//
// Retourne la liste de tous les comptes auth avec leur profil membre + rôles.
// Réservé aux administrateurs.

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['administrateur', 'president']);

    if (!callerRoles || callerRoles.length === 0) {
      throw new Error('Seul un administrateur ou président peut voir la liste des comptes');
    }

    // Liste des comptes auth (paginé par défaut à 50 -> on prend une grande page)
    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) throw new Error(`Erreur auth.admin.listUsers: ${authErr.message}`);

    const users = authList?.users || [];

    const { data: membres } = await supabaseAdmin.from('membres').select('*');
    const { data: roles } = await supabaseAdmin.from('user_roles').select('*, groupe:groupes(nom)');

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      membre: membres?.find((m) => m.user_id === u.id) || null,
      roles: roles?.filter((r) => r.user_id === u.id) || []
    }));

    return new Response(JSON.stringify({ users: result }), {
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