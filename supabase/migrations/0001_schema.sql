-- RelanceDevis AI — schéma principal
-- Multi-entreprise strict : toute donnée métier porte organization_id, protégée par RLS.

create extension if not exists "pgcrypto";

-- ───────────── Types ─────────────
create type member_role as enum ('owner', 'admin', 'member');
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');
create type campaign_status as enum ('active', 'paused', 'completed', 'stopped');
create type followup_status as enum ('scheduled', 'processing', 'sent', 'failed', 'cancelled', 'skipped');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid');

-- ───────────── Utilitaires ─────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── Entreprises & utilisateurs ─────────────
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  sender_name text,
  reply_to_email text,
  timezone text not null default 'Europe/Paris',
  send_window_start smallint not null default 9 check (send_window_start between 0 and 23),
  send_window_end smallint not null default 18 check (send_window_end between 1 and 24),
  send_days smallint[] not null default '{1,2,3,4,5}',
  default_delays smallint[] not null default '{3,7,14}',
  ai_enabled boolean not null default false,
  ai_requires_validation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (send_window_end > send_window_start)
);
create trigger trg_org_updated before update on organizations for each row execute function set_updated_at();

-- "users" : profil applicatif lié à auth.users (Supabase Auth)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated before update on users for each row execute function set_updated_at();

create table memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index idx_memberships_user on memberships(user_id);

-- Création automatique du profil à l'inscription
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into users (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  insert into organizations (name)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name', ''), 'Mon entreprise'))
    returning id into new_org;
  insert into memberships (organization_id, user_id, role) values (new_org, new.id, 'owner');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Fonctions d'appartenance (security definer pour éviter la récursion RLS)
create or replace function is_member(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.organization_id = org and m.user_id = auth.uid());
$$;
create or replace function is_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m
    where m.organization_id = org and m.user_id = auth.uid() and m.role in ('owner','admin'));
$$;

-- ───────────── Offres (modifiables sans redéploiement) ─────────────
create table plans (
  id text primary key,                      -- 'essentiel' | 'pro' | 'business'
  name text not null,
  price_monthly_cents integer not null check (price_monthly_cents >= 0),
  price_yearly_cents integer not null check (price_yearly_cents >= 0),
  stripe_price_monthly text,
  stripe_price_yearly text,
  limits jsonb not null default '{}'::jsonb,   -- ex: {"max_active_quotes":50,"max_users":1}
  features jsonb not null default '{}'::jsonb, -- ex: {"ai":false,"templates":false}
  active boolean not null default true,
  sort_order smallint not null default 0
);
insert into plans (id, name, price_monthly_cents, price_yearly_cents, limits, features, sort_order) values
 ('essentiel','Essentiel',1900,19000,'{"max_active_quotes":50,"max_users":1}','{"ai":false,"templates":false,"advanced_stats":false}',1),
 ('pro','Pro',2900,29000,'{"max_active_quotes":300,"max_users":1}','{"ai":true,"templates":true,"advanced_stats":true}',2),
 ('business','Business',4900,49000,'{"max_active_quotes":2000,"max_users":10}','{"ai":true,"templates":true,"advanced_stats":true,"multi_user":true}',3);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  plan_id text references plans(id),
  status subscription_status not null default 'incomplete',
  billing_interval text check (billing_interval in ('month','year')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_sub_updated before update on subscriptions for each row execute function set_updated_at();

-- Idempotence des webhooks Stripe
create table stripe_events (
  id text primary key,                      -- evt_...
  type text not null,
  processed_at timestamptz not null default now()
);

-- ───────────── Prospects & devis ─────────────
create table prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text,
  company text,
  notes text,
  email_opt_out boolean not null default false,   -- désinscription des relances
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prospects_org on prospects(organization_id);
create index idx_prospects_email on prospects(organization_id, lower(email));
create trigger trg_prospects_updated before update on prospects for each row execute function set_updated_at();

create table quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  prospect_id uuid not null references prospects(id) on delete cascade,
  reference text,
  title text not null check (char_length(title) between 1 and 300),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  status quote_status not null default 'draft',
  sent_at timestamptz,
  responded_at timestamptz,                 -- le client a répondu : stoppe les relances
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_quotes_org_status on quotes(organization_id, status);
create index idx_quotes_prospect on quotes(prospect_id);
create trigger trg_quotes_updated before update on quotes for each row execute function set_updated_at();

-- ───────────── Relances ─────────────
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  step smallint,                            -- numéro de relance visé (null = générique)
  subject text not null,
  body text not null,                       -- variables : {{prenom}} {{devis}} {{montant}} {{entreprise}}
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_templates_org on email_templates(organization_id);
create trigger trg_templates_updated before update on email_templates for each row execute function set_updated_at();

create table follow_up_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  quote_id uuid not null unique references quotes(id) on delete cascade,
  status campaign_status not null default 'active',
  delays smallint[] not null default '{3,7,14}',
  template_id uuid references email_templates(id) on delete set null,
  use_ai boolean not null default false,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_campaigns_org_status on follow_up_campaigns(organization_id, status);
create trigger trg_campaigns_updated before update on follow_up_campaigns for each row execute function set_updated_at();

create table follow_up_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid not null references follow_up_campaigns(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  step smallint not null check (step >= 1),
  scheduled_at timestamptz not null,
  status followup_status not null default 'scheduled',
  attempts smallint not null default 0,
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  subject text,
  body text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, step)                -- anti-doublon : une seule relance par étape
);
create index idx_followups_due on follow_up_logs(scheduled_at) where status in ('scheduled','failed');
create index idx_followups_org on follow_up_logs(organization_id, created_at desc);
create trigger trg_followups_updated before update on follow_up_logs for each row execute function set_updated_at();

-- ───────────── Notifications & audit ─────────────
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, read_at);

create table audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references organizations(id) on delete set null,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_org on audit_logs(organization_id, created_at desc);

-- ───────────── Row Level Security ─────────────
alter table organizations enable row level security;
alter table users enable row level security;
alter table memberships enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table stripe_events enable row level security;
alter table prospects enable row level security;
alter table quotes enable row level security;
alter table email_templates enable row level security;
alter table follow_up_campaigns enable row level security;
alter table follow_up_logs enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

create policy org_select on organizations for select using (is_member(id));
create policy org_update on organizations for update using (is_admin(id)) with check (is_admin(id));

create policy users_self_select on users for select using (id = auth.uid());
create policy users_self_update on users for update using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_select on memberships for select using (user_id = auth.uid() or is_admin(organization_id));

create policy plans_read on plans for select using (active);

create policy subs_select on subscriptions for select using (is_member(organization_id));
-- écritures sur subscriptions / stripe_events : service_role uniquement (webhook)

create policy prospects_all on prospects for all
  using (is_member(organization_id)) with check (is_member(organization_id));
create policy quotes_all on quotes for all
  using (is_member(organization_id)) with check (is_member(organization_id));
create policy templates_all on email_templates for all
  using (is_member(organization_id)) with check (is_member(organization_id));
create policy campaigns_all on follow_up_campaigns for all
  using (is_member(organization_id)) with check (is_member(organization_id));

create policy followups_select on follow_up_logs for select using (is_member(organization_id));
-- écritures sur follow_up_logs : service_role (moteur) uniquement

create policy notifications_select on notifications for select
  using (is_member(organization_id) and (user_id is null or user_id = auth.uid()));
create policy notifications_update on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select on audit_logs for select using (is_admin(organization_id));
-- écritures sur audit_logs : service_role uniquement

-- Cohérence : un devis doit appartenir à la même entreprise que son prospect
create or replace function check_quote_org() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from prospects p where p.id = new.prospect_id and p.organization_id = new.organization_id) then
    raise exception 'Le prospect n''appartient pas à cette entreprise';
  end if;
  return new;
end $$;
create trigger trg_quote_org before insert or update of prospect_id, organization_id on quotes
  for each row execute function check_quote_org();
