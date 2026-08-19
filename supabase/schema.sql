-- ============================================================================
-- FONDATION 18 SAFAR — SCHÉMA SUPABASE (PostgreSQL)
-- ============================================================================
-- Principe :
--  - "membres" = profil global, persiste toutes les années (1 QR code, 1 numéro)
--  - "campagnes" = une ligne par édition annuelle du 18 Safar
--  - Toutes les données opérationnelles (cotisations, dons, présences, etc.)
--    sont rattachées à une campagne_id => historique complet par année
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

create type role_systeme as enum (
  'membre',
  'responsable',
  'tresorier',
  'secretaire',
  'president',
  'administrateur'
);

create type statut_campagne as enum ('preparation', 'active', 'cloturee');
create type statut_membre_campagne as enum ('actif', 'inactif', 'suspendu');
create type type_don as enum ('bienfaiteur', 'anonyme');
create type type_objectif as enum ('global', 'activite');
create type statut_presence as enum ('present', 'absent', 'retard', 'excuse');
create type mode_paiement as enum ('especes', 'mobile_money', 'virement', 'cheque', 'autre');
create type sexe_type as enum ('masculin', 'feminin');

-- ============================================================================
-- 2. CAMPAGNES ANNUELLES
-- ============================================================================

create table campagnes (
  id uuid primary key default uuid_generate_v4(),
  annee integer not null unique,                -- ex: 2026 (ou année hégirienne si préféré)
  nom text not null,                             -- ex: "18 Safar 1447"
  date_evenement date not null,                  -- date retenue parmi les 18 jours de Safar
  date_debut_preparation date,
  statut statut_campagne not null default 'preparation',
  objectif_global numeric(14,2) default 0,
  cotisation_homme numeric(12,2) default 0,
  cotisation_femme numeric(12,2) default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index idx_campagnes_annee on campagnes(annee);

-- ============================================================================
-- 3. MEMBRES (profil global, indépendant de la campagne)
-- ============================================================================

create table membres (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) unique,   -- null tant que le membre n'a pas de compte
  numero_membre text not null unique,               -- ex: F18S-00042
  nom text not null,
  prenom text not null,
  telephone text,
  sexe sexe_type,
  email text,
  adresse text,
  date_naissance date,
  photo_url text,
  qr_code_value text not null unique default encode(gen_random_bytes(16), 'hex'),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_membres_numero on membres(numero_membre);
create index idx_membres_qrcode on membres(qr_code_value);
create index idx_membres_user on membres(user_id);

-- ============================================================================
-- 4. GROUPES / SERVICES (catalogue réutilisable d'année en année)
-- ============================================================================

create table groupes (
  id uuid primary key default uuid_generate_v4(),
  nom text not null unique,               -- Hygiène, Logistique, Sécurité...
  description text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 5. RATTACHEMENT MEMBRE <-> CAMPAGNE (groupe, fonction, statut par année)
-- ============================================================================

create table campagne_membres (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  groupe_id uuid references groupes(id),
  fonction text,                          -- ex: "Chef d'équipe", "Chauffeur"...
  statut statut_membre_campagne not null default 'actif',
  date_adhesion date default current_date,
  created_at timestamptz not null default now(),
  unique(campagne_id, membre_id)
);

create index idx_campagne_membres_campagne on campagne_membres(campagne_id);
create index idx_campagne_membres_groupe on campagne_membres(groupe_id);

-- Responsable(s) d'un groupe pour une campagne donnée
create table campagne_groupe_responsables (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  groupe_id uuid not null references groupes(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(campagne_id, groupe_id, membre_id)
);

-- ============================================================================
-- 6. RÔLES SYSTÈME (permissions applicatives)
-- ============================================================================
-- Un rôle peut être global (campagne_id null = administrateur/président toutes campagnes)
-- ou scopé à une campagne, et éventuellement restreint à un groupe (responsable).

create table user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role role_systeme not null,
  campagne_id uuid references campagnes(id) on delete cascade,  -- null = toutes campagnes
  groupe_id uuid references groupes(id) on delete cascade,      -- utilisé si role='responsable'
  created_at timestamptz not null default now(),
  unique(user_id, role, campagne_id, groupe_id)
);

create index idx_user_roles_user on user_roles(user_id);

-- ============================================================================
-- 7. FINANCES
-- ============================================================================

create table cotisations (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  membre_id uuid not null references membres(id),
  montant numeric(12,2) not null check (montant > 0),
  date_paiement date not null default current_date,
  mode_paiement mode_paiement default 'especes',
  note text,
  mois_cotisation text,
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_cotisations_campagne on cotisations(campagne_id);
create index idx_cotisations_membre on cotisations(membre_id);

create table collecteurs (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  membre_id uuid not null references membres(id),
  zone text,
  created_at timestamptz not null default now(),
  unique(campagne_id, membre_id)
);

create table dons (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  type type_don not null,
  donateur_nom text,                       -- null si anonyme
  donateur_telephone text,
  montant numeric(12,2) not null check (montant > 0),
  date_don date not null default current_date,
  campagne_activite text,                  -- rattachement à un objectif/activité (texte libre)
  note text,
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_dons_campagne on dons(campagne_id);

create table quetes (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  collecteur_id uuid references collecteurs(id),
  lieu text not null,
  date_quete date not null default current_date,
  montant numeric(12,2) not null check (montant >= 0),
  note text,
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_quetes_campagne on quetes(campagne_id);

create table depenses (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  categorie text not null,                 -- ex: Ravitaillement, Transport...
  montant numeric(12,2) not null check (montant > 0),
  date_depense date not null default current_date,
  description text,
  justificatif_url text,
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_depenses_campagne on depenses(campagne_id);

create table objectifs (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  type type_objectif not null,
  activite_nom text,                       -- null si type='global'
  montant_cible numeric(14,2) not null check (montant_cible > 0),
  created_at timestamptz not null default now()
);

create index idx_objectifs_campagne on objectifs(campagne_id);

-- Vue consolidée des recettes (cotisations + dons + quêtes) pour le tableau de bord
create view v_recettes as
  select id, campagne_id, 'cotisation'::text as source, montant, date_paiement as date, enregistre_par
  from cotisations
  union all
  select id, campagne_id, 'don'::text as source, montant, date_don as date, enregistre_par
  from dons
  union all
  select id, campagne_id, 'quete'::text as source, montant, date_quete as date, enregistre_par
  from quetes;

-- Sans ceci, la vue s'exécute avec les droits du propriétaire (postgres) et
-- contourne le RLS des tables sous-jacentes -> fuite de données financières.
alter view v_recettes set (security_invoker = true);

-- ============================================================================
-- 8. RÉUNIONS
-- ============================================================================

create table reunions (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  date_reunion date not null,
  heure time,
  lieu text,
  ordre_du_jour text,
  compte_rendu text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_reunions_campagne on reunions(campagne_id);

create table reunion_participants (
  id uuid primary key default uuid_generate_v4(),
  reunion_id uuid not null references reunions(id) on delete cascade,
  membre_id uuid not null references membres(id),
  statut_presence statut_presence default 'absent',
  enregistre_par uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(reunion_id, membre_id)
);

-- ============================================================================
-- 9. PRÉSENCES TERRAIN (événement / activités de groupe, hors réunions)
-- ============================================================================

create table presences_groupe (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  groupe_id uuid not null references groupes(id),
  membre_id uuid not null references membres(id),
  date_presence date not null default current_date,
  statut statut_presence not null default 'present',
  enregistre_par uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(campagne_id, groupe_id, membre_id, date_presence)
);

create index idx_presences_groupe_campagne on presences_groupe(campagne_id);

-- ============================================================================
-- 10. RAPPORTS
-- ============================================================================

create table rapports (
  id uuid primary key default uuid_generate_v4(),
  campagne_id uuid not null references campagnes(id) on delete cascade,
  type text not null,                      -- financier, activite, general...
  titre text not null,
  contenu text,
  fichier_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 11. FONCTIONS UTILITAIRES POUR RLS (SECURITY DEFINER = pas de récursion RLS)
-- ============================================================================

create or replace function fn_get_membre_id()
returns uuid
language sql security definer stable
as $$
  select id from membres where user_id = auth.uid();
$$;

create or replace function fn_has_role(p_roles role_systeme[], p_campagne_id uuid default null)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = any(p_roles)
      and (campagne_id is null or p_campagne_id is null or campagne_id = p_campagne_id)
  );
$$;

create or replace function fn_is_admin()
returns boolean
language sql security definer stable
as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'administrateur');
$$;

create or replace function fn_is_responsable_groupe(p_groupe_id uuid, p_campagne_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid()
      and role = 'responsable'
      and groupe_id = p_groupe_id
      and (campagne_id = p_campagne_id or campagne_id is null)
  );
$$;

-- ============================================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================================

alter table campagnes enable row level security;
alter table membres enable row level security;
alter table groupes enable row level security;
alter table campagne_membres enable row level security;
alter table campagne_groupe_responsables enable row level security;
alter table user_roles enable row level security;
alter table cotisations enable row level security;
alter table collecteurs enable row level security;
alter table dons enable row level security;
alter table quetes enable row level security;
alter table depenses enable row level security;
alter table objectifs enable row level security;
alter table reunions enable row level security;
alter table reunion_participants enable row level security;
alter table presences_groupe enable row level security;
alter table rapports enable row level security;

-- CAMPAGNES : lecture pour tout authentifié, écriture admin/président
create policy "campagnes_select" on campagnes for select to authenticated using (true);
create policy "campagnes_write" on campagnes for all to authenticated
  using (fn_has_role(array['administrateur','president']::role_systeme[]))
  with check (fn_has_role(array['administrateur','president']::role_systeme[]));

-- MEMBRES : lecture large (nécessaire pour scan QR par plusieurs rôles),
-- écriture réservée admin/secrétaire, ou le membre lui-même (champs perso)
create policy "membres_select" on membres for select to authenticated using (true);
create policy "membres_insert" on membres for insert to authenticated
  with check (fn_has_role(array['administrateur','secretaire']::role_systeme[]));
create policy "membres_update" on membres for update to authenticated
  using (fn_has_role(array['administrateur','secretaire']::role_systeme[]) or user_id = auth.uid())
  with check (fn_has_role(array['administrateur','secretaire']::role_systeme[]) or user_id = auth.uid());
create policy "membres_delete" on membres for delete to authenticated
  using (fn_is_admin());

-- GROUPES : lecture large, écriture admin
create policy "groupes_select" on groupes for select to authenticated using (true);
create policy "groupes_write" on groupes for all to authenticated
  using (fn_is_admin()) with check (fn_is_admin());

-- CAMPAGNE_MEMBRES : lecture large, écriture admin/secrétaire/responsable de son groupe, ou soi-même
create policy "campagne_membres_select" on campagne_membres for select to authenticated using (true);
create policy "campagne_membres_write" on campagne_membres for all to authenticated
  using (
    fn_has_role(array['administrateur','secretaire']::role_systeme[], campagne_id)
    or fn_is_responsable_groupe(groupe_id, campagne_id)
    or membre_id = fn_get_membre_id()
  )
  with check (
    fn_has_role(array['administrateur','secretaire']::role_systeme[], campagne_id)
    or fn_is_responsable_groupe(groupe_id, campagne_id)
    or membre_id = fn_get_membre_id()
  );

-- RESPONSABLES DE GROUPE : lecture large, écriture admin/président
create policy "responsables_select" on campagne_groupe_responsables for select to authenticated using (true);
create policy "responsables_write" on campagne_groupe_responsables for all to authenticated
  using (fn_has_role(array['administrateur','president']::role_systeme[], campagne_id))
  with check (fn_has_role(array['administrateur','president']::role_systeme[], campagne_id));

-- USER_ROLES : chacun voit ses propres rôles, admin voit/gère tout
create policy "user_roles_select_self" on user_roles for select to authenticated
  using (user_id = auth.uid() or fn_is_admin());
create policy "user_roles_write" on user_roles for all to authenticated
  using (fn_is_admin()) with check (fn_is_admin());

-- FINANCES (cotisations, dons, quêtes, dépenses, objectifs, collecteurs) :
-- lecture réservée trésorier/président/admin, un membre voit ses propres cotisations
create policy "cotisations_select" on cotisations for select to authenticated
  using (
    fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id)
    or membre_id = fn_get_membre_id()
  );
create policy "cotisations_write" on cotisations for all to authenticated
  using (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id));

create policy "collecteurs_select" on collecteurs for select to authenticated
  using (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id));
create policy "collecteurs_write" on collecteurs for all to authenticated
  using (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id));

create policy "dons_select" on dons for select to authenticated
  using (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id));
create policy "dons_write" on dons for all to authenticated
  using (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id));

create policy "quetes_select" on quetes for select to authenticated
  using (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id));
create policy "quetes_write" on quetes for all to authenticated
  using (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id));

create policy "depenses_select" on depenses for select to authenticated
  using (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id));
create policy "depenses_write" on depenses for all to authenticated
  using (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','administrateur']::role_systeme[], campagne_id));

-- OBJECTIFS : lecture large (tableau de bord public en interne), écriture admin/président/trésorier
create policy "objectifs_select" on objectifs for select to authenticated using (true);
create policy "objectifs_write" on objectifs for all to authenticated
  using (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['tresorier','president','administrateur']::role_systeme[], campagne_id));

-- RÉUNIONS : lecture large, écriture secrétaire/président/admin
create policy "reunions_select" on reunions for select to authenticated using (true);
create policy "reunions_write" on reunions for all to authenticated
  using (fn_has_role(array['secretaire','president','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['secretaire','president','administrateur']::role_systeme[], campagne_id));

create policy "reunion_participants_select" on reunion_participants for select to authenticated using (true);
create policy "reunion_participants_write" on reunion_participants for all to authenticated
  using (
    exists (
      select 1 from reunions r where r.id = reunion_id
      and fn_has_role(array['secretaire','president','administrateur']::role_systeme[], r.campagne_id)
    )
  )
  with check (
    exists (
      select 1 from reunions r where r.id = reunion_id
      and fn_has_role(array['secretaire','president','administrateur']::role_systeme[], r.campagne_id)
    )
  );

-- PRÉSENCES GROUPE : responsable du groupe (ou admin/secrétaire) enregistre ; lecture large
create policy "presences_groupe_select" on presences_groupe for select to authenticated using (true);
create policy "presences_groupe_write" on presences_groupe for all to authenticated
  using (
    fn_is_responsable_groupe(groupe_id, campagne_id)
    or fn_has_role(array['administrateur','secretaire']::role_systeme[], campagne_id)
  )
  with check (
    fn_is_responsable_groupe(groupe_id, campagne_id)
    or fn_has_role(array['administrateur','secretaire']::role_systeme[], campagne_id)
  );

-- RAPPORTS : lecture secrétaire/président/admin, écriture idem
create policy "rapports_select" on rapports for select to authenticated
  using (fn_has_role(array['secretaire','president','administrateur']::role_systeme[], campagne_id));
create policy "rapports_write" on rapports for all to authenticated
  using (fn_has_role(array['secretaire','president','administrateur']::role_systeme[], campagne_id))
  with check (fn_has_role(array['secretaire','president','administrateur']::role_systeme[], campagne_id));

-- ============================================================================
-- 13. GARDER LE PROJET SUPABASE ACTIF (anti-inactivité, plan Free)
-- ============================================================================
-- Table de heartbeat : un cron externe (ex: GitHub Actions, cron-job.org)
-- fait un simple insert/select ici toutes les quelques jours pour éviter
-- la pause automatique du projet Supabase Free après 7 jours d'inactivité.

create table system_heartbeat (
  id integer primary key default 1,
  last_ping timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into system_heartbeat (id) values (1);

create or replace function fn_ping_heartbeat()
returns void
language sql security definer
as $$
  update system_heartbeat set last_ping = now() where id = 1;
$$;

alter table system_heartbeat enable row level security;
create policy "heartbeat_select" on system_heartbeat for select to authenticated, anon using (true);


create sequence if not exists membre_numero_seq start 1;

alter table membres
  alter column numero_membre set default ('F18S-' || lpad(nextval('membre_numero_seq')::text, 5, '0'));

-- ============================================================================
-- 14. TRAÇABILITÉ — audit_logs
-- ============================================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  campagne_id uuid references campagnes(id),
  created_at timestamptz not null default now()
);

create index idx_audit_logs_user on audit_logs(user_id);
create index idx_audit_logs_entity on audit_logs(entity, entity_id);
create index idx_audit_logs_campagne on audit_logs(campagne_id);
create index idx_audit_logs_action on audit_logs(action);
create index idx_audit_logs_created on audit_logs(created_at desc);

alter table audit_logs enable row level security;

create policy "audit_logs_select_admin" on audit_logs for select to authenticated
  using (
    fn_has_role(array['president','administrateur']::role_systeme[], campagne_id)
    or fn_has_role(array['president','administrateur']::role_systeme[], null)
  );

create policy "audit_logs_insert_auth" on audit_logs for insert to authenticated
  with check (true);

-- ============================================================================
-- 15. NOTIFICATIONS
-- ============================================================================

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titre text not null,
  message text not null,
  type text not null default 'info',
  entity text,
  entity_id uuid,
  campagne_id uuid references campagnes(id),
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id, lu) where lu = false;
create index idx_notifications_campagne on notifications(campagne_id);

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_insert_auth" on notifications for insert to authenticated
  with check (true);
create policy "notifications_update_own" on notifications for update to authenticated
  using (user_id = auth.uid());
create policy "notifications_delete_own" on notifications for delete to authenticated
  using (user_id = auth.uid());

-- Enable Realtime for notifications
alter publication supabase_realtime add table notifications;