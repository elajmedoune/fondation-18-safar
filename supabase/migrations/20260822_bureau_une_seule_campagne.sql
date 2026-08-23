-- ============================================================================
-- RÈGLE : un membre du bureau (président / secrétaire / trésorier) appartient
-- à UNE SEULE campagne. Il ne peut donc pas cumuler deux rôles bureau
-- (même rôle ou rôles différents) sur des campagnes différentes.
-- L'administrateur, lui, reste global (campagne_id null) et n'est pas visé.
--
-- NB : les rôles 'responsable' (scopés à un groupe) et 'membre' ne sont pas
-- concernés par cette contrainte.
-- ============================================================================

-- Vérifier AVANT d'exécuter l'index qu'il n'existe pas déjà des cumuls :
--   select user_id, count(*) from user_roles
--   where role in ('president','secretaire','tresorier')
--   group by user_id having count(*) > 1;

create unique index if not exists idx_user_roles_un_seul_role_bureau
  on user_roles (user_id)
  where role in ('president', 'secretaire', 'tresorier');
