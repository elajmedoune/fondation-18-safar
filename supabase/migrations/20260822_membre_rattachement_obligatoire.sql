-- ============================================================================
-- RÈGLE : tout membre (hors compte admin global, qui n'est pas un membre)
-- doit être rattaché à au moins une campagne, GARANTI PAR LA BASE.
--
-- Problème résolu :
--   L'app crée le membre puis le rattachement dans 2 requêtes HTTP séparées.
--   Un trigger AFTER INSERT immédiat sur membres échoue donc toujours
--   (l'œuf et la poule). Solution : trigger CONTRAINTE DIFFÉRABLE qui
--   vérifie AU COMMIT, + RPC atomique (membre + rattachement ensemble).
-- ============================================================================

-- 1) Supprimer l'ancien trigger immédiat (cause de l'erreur 400)
drop trigger if exists trg_membre_doit_avoir_campagne on membres;
drop function if exists forbid_membre_hors_campagne();

-- 2) Vérification exécutée à la FIN de la transaction
create or replace function check_membre_rattache()
returns trigger
language plpgsql
as $$
begin
  -- Exception : les comptes liés à un ADMIN GLOBAL (campagne_id null)
  -- ne sont pas des membres -> pas de rattachement requis.
  if new.user_id is not null and exists (
    select 1 from user_roles ur
    where ur.user_id = new.user_id
      and ur.role = 'administrateur'
      and ur.campagne_id is null
  ) then
    return null;
  end if;

  if not exists (
    select 1 from campagne_membres cm where cm.membre_id = new.id
  ) then
    raise exception 'Un membre doit être rattaché à au moins une campagne';
  end if;

  return null;
end $$;

-- 3) Constraint trigger DIFFÉRABLE : le contrôle attend le COMMIT, ce qui
--    laisse le temps au rattachement (même transaction) d'être créé avant.
create constraint trigger trg_membre_doit_avoir_campagne
  after insert on membres
  deferrable initially deferred
  for each row
  execute function check_membre_rattache();

-- 4) RPC ATOMIQUE : crée le membre ET son rattachement dans UNE transaction.
--    security invoker : la RLS existante s'applique (admin/secrétaire).
--    Si p_campagne_id est null, seul un futur ADMIN GLOBAL est autorisé
--    (contrôlé par le trigger différé, qui lit user_roles au commit).
create or replace function creer_membre_dans_campagne(
  p_campagne_id uuid default null,
  p_user_id uuid default null,
  p_nom text default null,
  p_prenom text default null,
  p_telephone text default null,
  p_sexe sexe_type default null,
  p_photo_url text default null,
  p_groupe_id uuid default null,
  p_fonction text default null
)
returns membres
language plpgsql
security invoker
as $$
declare
  v_membre membres;
begin
  if p_nom is null or p_prenom is null then
    raise exception 'nom et prenom sont obligatoires';
  end if;

  insert into membres (user_id, nom, prenom, telephone, sexe, photo_url)
  values (p_user_id, p_nom, p_prenom, p_telephone, p_sexe, p_photo_url)
  returning * into v_membre;

  if p_campagne_id is not null then
    insert into campagne_membres (campagne_id, membre_id, groupe_id, fonction)
    values (p_campagne_id, v_membre.id, p_groupe_id, p_fonction);
  end if;

  return v_membre;
end $$;

grant execute on function creer_membre_dans_campagne(uuid, uuid, text, text, text, sexe_type, text, uuid, text) to authenticated;
