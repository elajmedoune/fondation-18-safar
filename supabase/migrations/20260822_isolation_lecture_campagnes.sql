-- ============================================================================
-- ISOLEMENT DES CAMPAGNES EN LECTURE (RLS)
--
-- Avant : la plupart des policies SELECT étaient ouvertes (using (true)) ->
-- en changeant de campagne via l'API, un bureau pouvait LIRE les données
-- d'une autre campagne. Désormais chaque lecture exige un rôle DANS LA
-- CAMPAGNE de la ligne. L'admin global (fn_is_admin) voit tout.
--
-- Jeux de rôles :
--   BUREAU  = president, secretaire, tresorier
--   EQUIPE  = secretaire, tresorier, president, administrateur
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MEMBRES : profil visible par soi-même, l'admin, ou le bureau d'une campagne
-- où le membre a une fiche (via campagne_membres).
-- ---------------------------------------------------------------------------
drop policy if exists "membres_select" on membres;
create policy "membres_select" on membres for select to authenticated
  using (
    user_id = auth.uid()
    or fn_is_admin()
    or exists (
      select 1 from campagne_membres cm
      where cm.membre_id = membres.id
        and fn_has_role(array['president','secretaire','tresorier']::role_systeme[], cm.campagne_id)
    )
  );

-- ---------------------------------------------------------------------------
-- CAMPAGNE_MEMBRES : sa propre fiche, le bureau de la campagne, ou le
-- responsable du groupe concerné.
-- ---------------------------------------------------------------------------
drop policy if exists "campagne_membres_select" on campagne_membres;
create policy "campagne_membres_select" on campagne_membres for select to authenticated
  using (
    membre_id = fn_get_membre_id()
    or fn_has_role(array['president','secretaire','tresorier']::role_systeme[], campagne_id)
    or fn_is_responsable_groupe(groupe_id, campagne_id)
  );

-- ---------------------------------------------------------------------------
-- GROUPES : bureau de leur campagne uniquement (+ admin).
-- ---------------------------------------------------------------------------
drop policy if exists "groupes_select" on groupes;
create policy "groupes_select" on groupes for select to authenticated
  using (
    fn_is_admin()
    or fn_has_role(array['president','secretaire','tresorier']::role_systeme[], campagne_id)
  );

-- ---------------------------------------------------------------------------
-- RÉUNIONS + PARTICIPANTS : équipe de la campagne (lecture élargie au bureau).
-- ---------------------------------------------------------------------------
drop policy if exists "reunions_select" on reunions;
create policy "reunions_select" on reunions for select to authenticated
  using (
    fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], campagne_id)
  );

drop policy if exists "reunion_participants_select" on reunion_participants;
create policy "reunion_participants_select" on reunion_participants for select to authenticated
  using (
    exists (
      select 1 from reunions r where r.id = reunion_id
        and fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], r.campagne_id)
    )
  );

-- ---------------------------------------------------------------------------
-- PRÉSENCES TERRAIN : responsable du groupe ou équipe de la campagne.
-- ---------------------------------------------------------------------------
drop policy if exists "presences_groupe_select" on presences_groupe;
create policy "presences_groupe_select" on presences_groupe for select to authenticated
  using (
    fn_is_responsable_groupe(groupe_id, campagne_id)
    or fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], campagne_id)
  );

-- ---------------------------------------------------------------------------
-- FINANCES : cotisations et objectifs n'étaient PAS scopés -> correction.
-- (dons, quêtes, dépenses, collecteurs l'étaient déjà)
-- NB : 'secretaire' inclus car la liste membres affiche la progression
-- cotisations à tout le bureau.
-- ---------------------------------------------------------------------------
drop policy if exists "cotisations_select_auth" on cotisations;
create policy "cotisations_select_auth" on cotisations for select to authenticated
  using (
    fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], campagne_id)
  );

drop policy if exists "objectifs_select" on objectifs;
create policy "objectifs_select" on objectifs for select to authenticated
  using (
    fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], campagne_id)
  );

-- ---------------------------------------------------------------------------
-- USER_ROLES : chacun voit ses rôles ; le bureau ne voit que les rôles DE SA
-- campagne ; l'admin voit tout. (Avant : le bureau voyait tous les rôles.)
-- ---------------------------------------------------------------------------
drop policy if exists "user_roles_select" on user_roles;
create policy "user_roles_select" on user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or fn_is_admin()
    or fn_has_role(array['president','secretaire','tresorier']::role_systeme[], campagne_id)
  );
