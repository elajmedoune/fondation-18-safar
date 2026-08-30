-- ============================================================================
-- Stockage des photos de membres : bucket + policies RLS
-- ============================================================================
-- Corrige l'erreur "new row violates row-level security policy" sur l'upload
-- des photos (cartess, profils, création de membres).
--
-- Le stockage Supabase est soumis à RLS : sans policy d'insertion sur
-- storage.objects, l'upload échoue pour les utilisateurs authentifiés.
-- ============================================================================

-- 1) Créer le bucket public s'il n'existe pas déjà
insert into storage.buckets (id, name, public)
values ('membres-photos', 'membres-photos', true)
on conflict (id) do update set public = true;

-- 2) Policies d'accès sur storage.objects pour CE bucket uniquement

-- Lecture : nécessaire pour lister/lire les objets via l'API (les URLs
-- publiques d'un bucket public fonctionnent aussi sans policy, mais on
-- autorise proprement la lecture authentifiée + anonyme sur ce bucket).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'membres_photos_select_read') then
    create policy "membres_photos_select_read"
      on storage.objects for select
      to public
      using (bucket_id = 'membres-photos');
  end if;
end $$;

-- Insertion : upload des photos (authenticated uniquement)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'membres_photos_insert_auth') then
    create policy "membres_photos_insert_auth"
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'membres-photos');
  end if;
end $$;

-- Mise à jour : ré-upload (upsert: true remplace le fichier existant)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'membres_photos_update_owner') then
    create policy "membres_photos_update_owner"
      on storage.objects for update
      to authenticated
      using (bucket_id = 'membres-photos')
      with check (bucket_id = 'membres-photos');
  end if;
end $$;

-- Suppression : (rarement utilisée par le front, mais pour compléter l'accès)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'membres_photos_delete_auth') then
    create policy "membres_photos_delete_auth"
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'membres-photos');
  end if;
end $$;