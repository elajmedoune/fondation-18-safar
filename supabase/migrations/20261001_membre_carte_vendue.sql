-- ============================================================================
-- MEMBRE OFFICIEL = PORTEUR DE CARTE
--
-- Un membre peut exister sans avoir achete sa carte. Seul un membre ayant
-- achete sa carte est "officiel" : lui seul peut avoir une cotisation.
--
-- Pourquoi une colonne et pas une table : la carte s'achete UNE FOIS, elle
-- vaut toutes les campagnes. Ce n'est donc pas une donnee par campagne
-- (contrairement a campagne_membres.statut, qui reste l'appartenance a une
-- campagne : actif / inactif / suspendu).
--
-- Reference aux cotisations :
--   - comme on ne peut pas, dans l'app, creer un membre sans numero (le
--     numero et le QR sont generes par defaut en base), tous les membres
--     existants sont consideres comme ayant achete leur carte ;
--   - les cotisations deja enregistrees restent donc valides.
-- ============================================================================

alter table membres
  add column if not exists carte_vendue boolean not null default false;

comment on column membres.carte_vendue is
  'true = membre officiel (a achete sa carte) : seul cas autorise a cotiser';

-- Migration des donnees : tout membre deja enregistre a recu sa carte, sinon
-- il n'aurait pas de numero. Les cotisations deja saisies restent coherentes.
update membres set carte_vendue = true where carte_vendue = false;

-- Index pour le select du membre dans l'ecran de cotisation, qui ne propose
-- que les membres officiels.
create index if not exists idx_membres_carte_vendue on membres(carte_vendue);

-- ============================================================================
-- GARDE-FOU EN BASE
--
-- L'interface filtre deja la liste des membres, mais la regle doit tenir
-- meme en cas d'import ou d'appel direct a l'API : c'est un trigger, pas
-- seulement un filtre d'ecran.
-- ============================================================================
create or replace function refuser_cotisation_sans_carte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from membres m where m.id = new.membre_id and m.carte_vendue) then
    raise exception 'Membre non officiel : la carte n''a pas ete achetee, aucune cotisation possible'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cotisation_exige_carte on cotisations;

create trigger trg_cotisation_exige_carte
  before insert or update of membre_id on cotisations
  for each row
  execute function refuser_cotisation_sans_carte();

-- ============================================================================
-- CREATION D'UN MEMBRE : la case "a deja achete sa carte"
--
-- La creation passe par la RPC creer_membre_dans_campagne, il faut donc
-- lui ajouter le parametre. On recreate la fonction avec le parametre a la
-- FIN de la liste pour rester compatible avec les appels existants qui
-- passent les arguments par nom.
-- ============================================================================
create or replace function creer_membre_dans_campagne(
  p_campagne_id uuid default null,
  p_user_id uuid default null,
  p_nom text default null,
  p_prenom text default null,
  p_telephone text default null,
  p_sexe sexe_type default null,
  p_photo_url text default null,
  p_groupe_id uuid default null,
  p_fonction text default null,
  p_carte_vendue boolean default false
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

  insert into membres (user_id, nom, prenom, telephone, sexe, photo_url, carte_vendue)
  values (p_user_id, p_nom, p_prenom, p_telephone, p_sexe, p_photo_url, coalesce(p_carte_vendue, false))
  returning * into v_membre;

  if p_campagne_id is not null then
    insert into campagne_membres (campagne_id, membre_id, groupe_id, fonction)
    values (p_campagne_id, v_membre.id, p_groupe_id, p_fonction);
  end if;

  return v_membre;
end $$;

grant execute on function creer_membre_dans_campagne(uuid, uuid, text, text, text, sexe_type, text, uuid, text, boolean) to authenticated;

-- Le RPC renvoie membres (toutes colonnes), donc carte_vendue est deja
-- comprise dans le retour.
