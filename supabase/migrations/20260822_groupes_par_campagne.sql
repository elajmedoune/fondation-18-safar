-- ============================================================================
-- GROUPES PAR CAMPAGNE : chaque campagne possède ses PROPRES groupes
-- (avant : catalogue global réutilisé d'une année sur l'autre).
--
-- Stratégie de migration :
--   1. Ajouter campagne_id à "groupes"
--   2. Dupliquer les groupes globaux existants dans CHAQUE campagne
--   3. Remapper les références (rattachements membres, responsables,
--      présences terrain, rôles responsable) vers la copie DE LEUR campagne
--   4. Supprimer les anciens groupes globaux
--   5. Rendre le lien obligatoire + unicité (campagne_id, nom)
--
-- NB : dans UPDATE ... FROM, la table cible n'est référençable QUE dans le
-- WHERE -> jointures écrites en FROM multiple avec conditions dans WHERE.
-- ============================================================================

begin;

-- 1) Nouvelle colonne (nullable le temps de la migration) — idempotent
alter table groupes
  add column if not exists campagne_id uuid references campagnes(id) on delete cascade;

-- 2) Duplication des groupes globaux pour chaque campagne existante
--    (garde anti-doublon si la migration est relancée après un échec partiel)
insert into groupes (campagne_id, nom, description, actif, created_at)
select c.id, g.nom, g.description, g.actif, g.created_at
from campagnes c
cross join groupes g
where g.campagne_id is null
  and not exists (
    select 1 from groupes x
    where x.campagne_id = c.id and x.nom = g.nom
  );

-- 3a) Remapper les rattachements membres vers la copie de LEUR campagne
update campagne_membres cm
set groupe_id = ng.id
from groupes og,
     campagnes c,
     groupes ng
where c.id = cm.campagne_id
  and ng.campagne_id = c.id
  and ng.nom = og.nom
  and cm.groupe_id = og.id
  and og.campagne_id is null;

-- 3b) Remapper les responsables de groupe
update campagne_groupe_responsables cgr
set groupe_id = ng.id
from groupes og,
     campagnes c,
     groupes ng
where c.id = cgr.campagne_id
  and ng.campagne_id = c.id
  and ng.nom = og.nom
  and cgr.groupe_id = og.id
  and og.campagne_id is null;

-- 3c) Remapper les présences terrain
update presences_groupe pg
set groupe_id = ng.id
from groupes og,
     campagnes c,
     groupes ng
where c.id = pg.campagne_id
  and ng.campagne_id = c.id
  and ng.nom = og.nom
  and pg.groupe_id = og.id
  and og.campagne_id is null;

-- 3d) Remapper les rôles "responsable" scopés à un groupe
update user_roles ur
set groupe_id = ng.id
from groupes og,
     campagnes c,
     groupes ng
where c.id = ur.campagne_id
  and ng.campagne_id = c.id
  and ng.nom = og.nom
  and ur.groupe_id = og.id
  and og.campagne_id is null;

-- 4) Supprimer les anciens groupes globaux (toutes les refs ont été remappées)
delete from groupes where campagne_id is null;

-- 5) Lien obligatoire + unicité du nom AU SEIN d'une campagne
alter table groupes alter column campagne_id set not null;
alter table groupes drop constraint if exists groupes_nom_key;
alter table groupes add constraint groupes_campagne_nom_key unique (campagne_id, nom);

commit;

-- ============================================================================
-- RLS : l'écriture des groupes reste réservée à l'admin GLOBAL, mais aussi
-- au bureau (président/secrétaire) DE LA campagne concernée.
-- ============================================================================
drop policy "groupes_write" on groupes;
create policy "groupes_write" on groupes for all to authenticated
  using (
    fn_is_admin()
    or fn_has_role(array['president','secretaire']::role_systeme[], campagne_id)
  )
  with check (
    fn_is_admin()
    or fn_has_role(array['president','secretaire']::role_systeme[], campagne_id)
  );
