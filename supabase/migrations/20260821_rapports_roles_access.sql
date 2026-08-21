-- Accès aux rapports par rôle du bureau :
--   president / administrateur : lecture + écriture de tous les rapports (tous types)
--   secretaire : lecture de tous ; écriture des types general/activite, ou de ses propres rapports
--   tresorier  : lecture de tous ; écriture du type financier uniquement, ou de ses propres rapports

drop policy if exists "rapports_select" on rapports;
drop policy if exists "rapports_write" on rapports;

create policy "rapports_select" on rapports for select to authenticated
  using (fn_has_role(array['secretaire','tresorier','president','administrateur']::role_systeme[], campagne_id));

create policy "rapports_write" on rapports for all to authenticated
  using (
    fn_has_role(array['president','administrateur']::role_systeme[], campagne_id)
    or (
      created_by = auth.uid()
      and fn_has_role(array['secretaire','tresorier']::role_systeme[], campagne_id)
    )
    or (
      fn_has_role(array['secretaire']::role_systeme[], campagne_id)
      and coalesce(type, 'general') in ('general','activite')
    )
    or (
      fn_has_role(array['tresorier']::role_systeme[], campagne_id)
      and type = 'financier'
    )
  )
  with check (
    fn_has_role(array['president','administrateur']::role_systeme[], campagne_id)
    or (
      fn_has_role(array['secretaire']::role_systeme[], campagne_id)
      and coalesce(type, 'general') in ('general','activite')
    )
    or (
      fn_has_role(array['tresorier']::role_systeme[], campagne_id)
      and type = 'financier'
    )
  );
