-- ============================================================================
-- NOTIFICATIONS — Table pour notifier les membres du bureau
-- ============================================================================

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titre text not null,
  message text not null,
  type text not null default 'info',         -- info, success, warning, action
  entity text,                               -- table concernée (cotisations, depenses, etc.)
  entity_id uuid,
  campagne_id uuid references campagnes(id),
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id, lu) where lu = false;
create index idx_notifications_campagne on notifications(campagne_id);

alter table notifications enable row level security;

-- L'utilisateur voit ses propres notifs
create policy "notifications_select_own" on notifications for select to authenticated
  using (user_id = auth.uid());

-- Tout le monde peut insérer (les services en ont besoin)
create policy "notifications_insert_auth" on notifications for insert to authenticated
  with check (true);

-- L'utilisateur peut marquer les siennes comme lues
create policy "notifications_update_own" on notifications for update to authenticated
  using (user_id = auth.uid());

-- L'utilisateur peut supprimer les siennes
create policy "notifications_delete_own" on notifications for delete to authenticated
  using (user_id = auth.uid());
