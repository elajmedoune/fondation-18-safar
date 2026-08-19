-- ============================================================================
-- TRAÇABILITÉ — Table audit_logs
-- ============================================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,              -- ex: 'cotisation.create', 'role.assign', 'campagne.activate'
  entity text not null,              -- table concernée: 'cotisations', 'user_roles', etc.
  entity_id uuid,                    -- ID de l'enregistrement modifié
  old_data jsonb,                    -- état avant modification (update/delete)
  new_data jsonb,                    -- état après modification (create/update)
  campagne_id uuid references campagnes(id),
  created_at timestamptz not null default now()
);

create index idx_audit_logs_user on audit_logs(user_id);
create index idx_audit_logs_entity on audit_logs(entity, entity_id);
create index idx_audit_logs_campagne on audit_logs(campagne_id);
create index idx_audit_logs_action on audit_logs(action);
create index idx_audit_logs_created on audit_logs(created_at desc);

-- RLS: seuls les président et administrateurs peuvent tout lire
-- Les trésoriers et secrétaires voient les logs de leur campagne
alter table audit_logs enable row level security;

create policy "audit_logs_select_admin" on audit_logs for select to authenticated
  using (
    fn_has_role(array['president','administrateur']::role_systeme[], campagne_id)
    or fn_has_role(array['president','administrateur']::role_systeme[], null)
  );

create policy "audit_logs_insert_service" on audit_logs for insert to authenticated
  with check (true);

-- Aussi ajouter à schema.sql
