-- Promptfun control plane. Apply only to the control database.
create extension if not exists pgcrypto;

create table if not exists public.platform_users (
  id uuid primary key, email text not null, created_at timestamptz not null default now()
);
create table if not exists public.platform_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.platform_users(id),
  token_hash text not null unique, csrf_token text not null, auth_token_ciphertext text,
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists platform_sessions_expiry on public.platform_sessions(expires_at);
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.platform_users(id),
  title text not null check (length(title) between 1 and 120), description text not null default '',
  wallet_address text, published_version_id uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner on public.projects(owner_id, updated_at desc);
create table if not exists public.app_versions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  parent_version_id uuid, prompt text not null, html text not null,
  manifest jsonb not null, content_hash text not null, changelog jsonb not null default '[]',
  created_at timestamptz not null default now(), unique(project_id,id),
  foreign key(project_id,parent_version_id) references public.app_versions(project_id,id),
  check (octet_length(html) <= 2097152)
);
alter table public.projects drop constraint if exists projects_published_version_fk;
alter table public.projects add constraint projects_published_version_fk
  foreign key(id,published_version_id) references public.app_versions(project_id,id);
create index if not exists app_versions_project on public.app_versions(project_id,created_at desc);
create or replace function public.protect_app_version() returns trigger language plpgsql as $$
begin raise exception 'App versions are immutable'; end $$;
drop trigger if exists app_versions_immutable on public.app_versions;
create trigger app_versions_immutable before update or delete on public.app_versions
  for each row execute function public.protect_app_version();

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.platform_users(id),
  provider text not null default 'openrouter' check(provider='openrouter'), secret_ciphertext text not null,
  key_hash text not null, state text not null default 'active' check(state in ('active','revoked','blocked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revoked_at timestamptz
);
create unique index if not exists one_active_provider_connection on public.provider_connections(owner_id) where state='active';
create table if not exists public.auth_flows (
  state_hash text primary key, purpose text not null check(purpose in ('google','openrouter')),
  user_id uuid references public.platform_users(id), session_id uuid references public.platform_sessions(id),
  verifier_ciphertext text not null, expires_at timestamptz not null, consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.free_quota_days (
  owner_id uuid not null references public.platform_users(id), day date not null,
  used integer not null default 0 check(used>=0), held integer not null default 0 check(held>=0),
  primary key(owner_id,day)
);
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  actor_id uuid not null references public.platform_users(id), connection_id uuid not null references public.provider_connections(id),
  base_version_id uuid, prompt text not null, model text not null,
  idempotency_key text not null, request_hash text not null, quota_day date not null,
  status text not null default 'queued' check(status in ('queued','running','validating','completed','failed','uncertain','cancelled','no_changes')),
  usage_status text not null default 'pending' check(usage_status in ('pending','reported','unknown')),
  error text, result_version_id uuid, lease_owner text, lease_until timestamptz,
  prompt_tokens bigint, completion_tokens bigint, cost_usd numeric(24,12),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(project_id,base_version_id) references public.app_versions(project_id,id),
  foreign key(project_id,result_version_id) references public.app_versions(project_id,id),
  unique(actor_id,idempotency_key)
);
create index if not exists jobs_queue on public.generation_jobs(status,created_at);
create index if not exists jobs_owner on public.generation_jobs(actor_id,created_at desc);
create table if not exists public.generation_attempts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null unique references public.generation_jobs(id),
  number integer not null default 1 check(number=1), provider text not null default 'openrouter',
  usage_mode text not null default 'user_free' check(usage_mode='user_free'), payer_id uuid not null references public.platform_users(id),
  connection_id uuid not null references public.provider_connections(id), model text not null,
  state text not null default 'prepared' check(state in ('prepared','submitted','responded','rejected','uncertain')),
  request_id text, submitted_at timestamptz, responded_at timestamptz,
  raw_usage jsonb, created_at timestamptz not null default now(), reconcile_checks integer not null default 0,
  next_reconcile_at timestamptz
);
create table if not exists public.usage_receipts (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.generation_attempts(id),
  revision integer not null, prompt_tokens bigint, completion_tokens bigint, cost_usd numeric(24,12),
  currency text not null default 'USD', raw_usage jsonb not null, source text not null,
  created_at timestamptz not null default now(), unique(attempt_id,revision)
);
create table if not exists public.migration_batches (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.platform_users(id),
  project_id uuid not null references public.projects(id), manifest_hash text not null, idempotency_key text not null,
  version_ids uuid[] not null default '{}', created_at timestamptz not null default now(),
  unique(owner_id,idempotency_key), unique(owner_id,project_id,manifest_hash)
);
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  version_id uuid not null, author_id uuid not null references public.platform_users(id),
  text text not null check(length(text) between 1 and 2000),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), moderated_at timestamptz,
  foreign key(project_id,version_id) references public.app_versions(project_id,id)
);
create index if not exists feedback_project on public.feedback(project_id,created_at desc);

-- Never expose the control tables through Supabase's browser REST API.
alter table public.platform_users enable row level security;
alter table public.platform_sessions enable row level security;
alter table public.projects enable row level security;
alter table public.app_versions enable row level security;
alter table public.provider_connections enable row level security;
alter table public.auth_flows enable row level security;
alter table public.free_quota_days enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generation_attempts enable row level security;
alter table public.usage_receipts enable row level security;
alter table public.migration_batches enable row level security;
alter table public.feedback enable row level security;
revoke all on public.platform_users,public.platform_sessions,public.projects,public.app_versions,
 public.provider_connections,public.auth_flows,public.free_quota_days,public.generation_jobs,
 public.generation_attempts,public.usage_receipts,public.migration_batches,public.feedback from public;
-- Supabase defines these roles; a portable Neon database need not have them.
-- Do not create or alter managed/global roles just to apply the application schema.
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on public.platform_users,public.platform_sessions,public.projects,public.app_versions,
        public.provider_connections,public.auth_flows,public.free_quota_days,public.generation_jobs,
        public.generation_attempts,public.usage_receipts,public.migration_batches,public.feedback from %I', browser_role);
    end if;
  end loop;
end $$;
