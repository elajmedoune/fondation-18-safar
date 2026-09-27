-- ============================================================================
-- Sécurité : restreindre la modification et la suppression des photos de membres
-- ============================================================================
-- La migration 20260830 a créé une policy nommée "membres_photos_update_owner"
-- dont la condition est uniquement :
--
--     using (bucket_id = 'membres-photos')
--
-- Le nom promettait une restriction au propriétaire, mais la condition n'en
-- imposait AUCUNE : n'importe quel utilisateur authentifié pouvait remplacer
-- ou supprimer la photo de n'importe quel membre, pourvu qu'il connaisse le
-- nom du fichier (qui est l'UUID du membre + ".jpg", visible dans l'URL
-- publique du bucket).
--
-- On aligne Storage sur le modèle de permissions déjà appliqué à la table
-- "membres" (cf. schema.sql) :
--   - le bureau (président, trésorier, secrétaire) et l'administrateur
--     gèrent les photos de la campagne ;
--   - chaque membre peut gérer SA propre photo.
-- ============================================================================

-- 1) Un membre est-il autorisé à écrire dans le bucket photos ?
--    (bureau + administrateur, quelle que soit la campagne)
create or replace function fn_can_write_membres_photos()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = any (
        array['administrateur', 'president', 'tresorier', 'secretaire']::role_systeme[]
      )
  );
$$;

-- 2) L'objet stocké est-il la photo du membre connecté ?
--    Le nom des fichiers est "<membre_id>.jpg" (ou "temp-<timestamp>.jpg" pour
--    une photo saisie avant l'enregistrement du membre). On compare donc le
--    nom de l'objet à l'UUID des membres rattachés à l'utilisateur.
create or replace function fn_owns_membres_photo(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from membres m
    where m.user_id = auth.uid()
      and (
        p_name = m.id::text || '.jpg'
        or p_name = m.id::text
        or p_name like m.id::text || '.%'
      )
  );
$$;

-- 3) Règle unique appliquée aux écritures : bureau/admin OU photo personnelle.
create or replace function fn_can_write_membres_photo(p_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select fn_can_write_membres_photos() or fn_owns_membres_photo(p_name);
$$;

-- 4) Remplacement des policies trop larges.
--    "drop policy if exists" puis "create policy" : plus simple et plus fiable
--    que la modification en place, et sans risque si la policy n'existe pas.

drop policy if exists "membres_photos_update_owner" on storage.objects;
create policy "membres_photos_update_authorized"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'membres-photos'
    and fn_can_write_membres_photo(name)
  )
  with check (
    bucket_id = 'membres-photos'
    and fn_can_write_membres_photo(name)
  );

drop policy if exists "membres_photos_delete_auth" on storage.objects;
create policy "membres_photos_delete_authorized"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'membres-photos'
    and fn_can_write_membres_photo(name)
  );

-- 5) L'insertion reste ouverte à tout utilisateur authentifié : c'est
--    nécessaire à la saisie d'une photo AVANT l'enregistrement du membre
--    (fichier "temp-<timestamp>.jpg", cf. MembresList.jsx), où aucun membre
--    n'existe encore pour rattacher le fichier. Insérer ne permet pas
--    d'écraser un fichier existant : l'"upsert" exige aussi la policy UPDATE,
--    désormais restreinte. Le risque résiduel est un dépôt de fichiers
--    parasites, sans impact sur les données des membres.
--
-- La lecture ("membres_photos_select_read") reste inchangée : le bucket est
-- public, les photos sont de toute façon accessibles par URL.
