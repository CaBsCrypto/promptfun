create table public.platform_mutation_receipts (
 user_id uuid not null references public.platform_users(id), idempotency_key text not null,
 kind text not null check(kind in ('project.create','project.publish')), request_hash text not null,
 response_status int not null check(response_status between 200 and 299), response jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,idempotency_key)
);
create table public.publication_history (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, version_id uuid not null,
 published_at timestamptz not null default now(),
 foreign key(project_id,version_id) references public.app_versions(project_id,id)
);
create index publication_history_project on public.publication_history(project_id,published_at desc);
create trigger publication_history_immutable before update or delete on public.publication_history
 for each row execute function public.protect_app_version();
-- Preserve the currently public version when upgrading an existing installation.
insert into public.publication_history(project_id,version_id)
 select id,published_version_id from public.projects where published_version_id is not null;
alter table public.platform_mutation_receipts enable row level security;
alter table public.publication_history enable row level security;
revoke all on public.platform_mutation_receipts,public.publication_history from public;
do $$ declare browser_role text; begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on public.platform_mutation_receipts,public.publication_history from %I',browser_role);
  end if;
 end loop;
end $$;
