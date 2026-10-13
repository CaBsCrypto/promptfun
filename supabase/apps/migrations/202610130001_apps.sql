create table public.app_instances (
 id uuid primary key, created_at timestamptz not null default now()
);
create table public.app_users (
 id uuid primary key, auth_provider text not null check(auth_provider in ('neon','supabase')),
 auth_subject text not null, email text not null,
 created_at timestamptz not null default now(), unique(auth_provider,auth_subject)
);
create table public.app_memberships (
 app_id uuid not null references public.app_instances(id),
 user_id uuid not null references public.app_users(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(app_id,user_id)
);
create table public.app_records (
 id uuid primary key default gen_random_uuid(), app_id uuid not null,
 user_id uuid not null, collection text not null check(collection ~ '^[a-z][a-z0-9_]{0,39}$'),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=65536),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(app_id,user_id) references public.app_memberships(app_id,user_id) on delete cascade
);
create index app_records_scope on public.app_records(app_id,user_id,collection,created_at);
create table public.app_files (
 id uuid primary key default gen_random_uuid(), app_id uuid not null, user_id uuid not null,
 name text not null, mime_type text not null, size_bytes int not null check(size_bytes between 1 and 5242880),
 object_path text not null unique, sha256 text not null, created_at timestamptz not null default now(),
 foreign key(app_id,user_id) references public.app_memberships(app_id,user_id) on delete cascade
);
create table public.app_sessions (
 token_hash text primary key, app_id uuid not null, user_id uuid not null,
 csrf_token text not null, expires_at timestamptz not null,
 auth_token_ciphertext text not null, identity_checked_at timestamptz not null default now(),
 foreign key(app_id,user_id) references public.app_memberships(app_id,user_id) on delete cascade
);
alter table public.app_instances enable row level security;
alter table public.app_users enable row level security;
alter table public.app_memberships enable row level security;
alter table public.app_records enable row level security;
alter table public.app_files enable row level security;
alter table public.app_sessions enable row level security;
revoke all on public.app_instances,public.app_users,public.app_memberships,public.app_records,public.app_files,public.app_sessions from public;
do $$ declare browser_role text; begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on public.app_instances,public.app_users,public.app_memberships,public.app_records,public.app_files,public.app_sessions from %I',browser_role);
  end if;
 end loop;
 -- Optional Supabase adapter; Neon uses a separately provisioned private S3 bucket.
 if to_regclass('storage.buckets') is not null then
  execute 'insert into storage.buckets(id,name,public,file_size_limit) values(''app-files'',''app-files'',false,5242880) on conflict do nothing';
 end if;
end $$;
-- No browser SQL or object grants. RLS has no permissive browser policy: direct access
-- fails closed, while the server gateway checks identity, app, version and manifest.
