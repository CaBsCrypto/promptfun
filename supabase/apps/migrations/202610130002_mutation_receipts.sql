-- Server-only durable receipts. A mutation and its receipt commit atomically.
create table if not exists public.app_mutation_receipts (
 app_id uuid not null, user_id uuid not null,
 idempotency_key text not null check(idempotency_key ~ '^[a-zA-Z0-9_-]{16,128}$'),
 kind text not null check(kind in ('record.create','file.upload')),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 response_status int not null check(response_status=201),
 response jsonb not null check(jsonb_typeof(response)='object'),
 created_at timestamptz not null default now(),
 primary key(app_id,user_id,idempotency_key),
 foreign key(app_id,user_id) references public.app_memberships(app_id,user_id) on delete cascade
);
alter table public.app_mutation_receipts enable row level security;
revoke all on public.app_mutation_receipts from public;
do $$ declare browser_role text; begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on public.app_mutation_receipts from %I',browser_role);
  end if;
 end loop;
end $$;
