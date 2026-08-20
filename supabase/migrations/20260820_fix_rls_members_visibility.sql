-- ============================================================================
-- FIX: RLS policies pour la visibilité des membres
--
-- Problème 1 : user_roles empêche le secrétaire/président de voir les rôles
--   des autres membres → les membres du bureau disparaissent de la liste
--   et les badges de fonction ne s'affichent pas.
--
-- Problème 2 : cotisations empêche le secrétaire de voir les cotisations
--   des autres membres → impossible de voir qui a atteint son objectif.
-- ============================================================================

-- 1) USER_ROLES : permettre aux rôles bureau de voir tous les rôles
--    (nécessaire pour l'enrichissement dans getByCampagneAvecRoles)
DROP POLICY IF EXISTS "user_roles_select_self" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR fn_is_admin()
    OR fn_has_role(array['president','secretaire','tresorier']::role_systeme[])
  );

-- 2) COTISATIONS : permettre à tout authentifié de lire les cotisations
--    (nécessaire pour afficher la progression des cotisations dans la liste membres)
DROP POLICY IF EXISTS "cotisations_select" ON cotisations;
CREATE POLICY "cotisations_select_auth" ON cotisations FOR SELECT TO authenticated
  USING (true);
