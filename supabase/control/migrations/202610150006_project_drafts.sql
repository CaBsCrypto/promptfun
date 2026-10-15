-- Private creator working state. Ownership follows projects.owner_id; the BFF
-- verifies that owner for every operation. Browser database roles have no access.
create table public.project_drafts (
  project_id uuid primary key references public.projects(id) on delete cascade,
  prompt text not null default '' check(char_length(prompt)<=20000),
  model text not null default '' check(char_length(model)<=200),
  base_version_id uuid,
  revision integer not null check(revision>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(project_id,base_version_id) references public.app_versions(project_id,id)
);
alter table public.project_drafts enable row level security;
revoke all on public.project_drafts from public;
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on public.project_drafts from %I',browser_role);
    end if;
  end loop;
end $$;
