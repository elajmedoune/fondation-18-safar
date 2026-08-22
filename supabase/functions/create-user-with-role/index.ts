// supabase/functions/create-user-with-role/index.ts
//
// Reçoit : email, role, campagne_id + UN des 3 modes de profil :
//   a) sans_profil_membre: true            -> compte technique SANS fiche membre
//   b) existing_membre_id                  -> lie un compte à une fiche membre existante
//   c) nom, prenom, telephone, membre_groupe_id -> crée la fiche membre (+ rattachement)
//
// Fait :
//   1. Envoie une invitation par email (le compte auth.users est créé automatiquement)
//   2. Attribue le rôle demandé dans "user_roles"
//   3. Crée/lie la fiche membre selon le mode
//
// Sécurité : n'accepte la requête que si l'appelant est lui-même administrateur
// (vérifié via son token, avant d'utiliser la clé service_role).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body, status) => new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Non authentifié' }, 401);

    // Client "au nom de l'appelant" pour vérifier qu'il est bien admin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) return json({ error: 'Session invalide' }, 401);

    const { data: callerRoles } = await supabaseUser
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'administrateur');

    if (!callerRoles || callerRoles.length === 0) {
      return json({ error: "Seul un administrateur peut créer un utilisateur" }, 403);
    }

    const body = await req.json();
    const {
      email, nom, prenom, telephone, role, campagne_id,
      groupe_id, existing_membre_id, sans_profil_membre, membre_groupe_id
    } = body;

    // Validation selon le mode de profil
    if (!email || !role) {
      return json({ error: 'Email et rôle requis' }, 400);
    }
    if (!sans_profil_membre && !existing_membre_id && (!nom || !prenom)) {
      return json({ error: 'Nom et prénom requis pour créer une nouvelle fiche membre' }, 400);
    }

    // Client admin (clé service_role, jamais exposée au navigateur)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // 1. Invitation email -> crée le compte auth.users et envoie le lien de connexion
    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteErr) throw inviteErr;

    const newUserId = invited.user.id;

    // En cas d'échec plus loin, on ne laisse pas un rôle orphelin derrière.
    const rollbackRole = async () => {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', newUserId).eq('role', role);
    };

    try {
      // 2. Attribuer le rôle D'ABORD : le trigger différé sur "membres" lit
      //    user_roles au COMMIT pour exempter les admins globaux (sans campagne).
      const { error: roleErr } = await supabaseAdmin.from('user_roles').insert({
        user_id: newUserId,
        role,
        campagne_id: campagne_id || null,
        groupe_id: groupe_id || null
      });
      if (roleErr) throw roleErr;

      if (sans_profil_membre) {
        // 3a. Compte technique : pas de fiche membre (exempté par le trigger).
        return json({ success: true, user_id: newUserId }, 200);
      }

      if (existing_membre_id) {
        // 3b. Lier une fiche membre existante au nouveau compte.
        //     NB : UPDATE sur membres -> le trigger INSERT ne se déclenche pas.
        const { data: m } = await supabaseAdmin
          .from('membres')
          .select('id, user_id')
          .eq('id', existing_membre_id)
          .maybeSingle();
        if (!m) throw new Error('Membre introuvable.');
        if (m.user_id && m.user_id !== newUserId) throw new Error('Ce membre est déjà lié à un autre compte.');

        const { error: updErr } = await supabaseAdmin
          .from('membres')
          .update({ user_id: newUserId })
          .eq('id', m.id);
        if (updErr) throw updErr;

        return json({ success: true, user_id: newUserId }, 200);
      }

      // 3c. Nouvelle fiche membre + rattachement campagne EN UNE SEULE TRANSACTION
      //     via la RPC (le trigger différé exige le rattachement dès la création).
      const { data: membre, error: membreErr } = await supabaseAdmin.rpc(
        'creer_membre_dans_campagne',
        {
          p_campagne_id: campagne_id || null,
          p_user_id: newUserId,
          p_nom: nom,
          p_prenom: prenom,
          p_telephone: telephone || null,
          p_groupe_id: membre_groupe_id || groupe_id || null
        }
      );
      if (membreErr) throw membreErr;

      return json({ success: true, user_id: newUserId }, 200);
    } catch (err) {
      await rollbackRole();
      throw err;
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
