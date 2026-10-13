-- Keep gateway UUID ownership independent from the managed identity provider's opaque IDs.
alter table public.platform_users add column if not exists auth_provider text not null default 'supabase';
alter table public.platform_users add column if not exists auth_subject text;
update public.platform_users set auth_subject=id::text where auth_subject is null;
alter table public.platform_users add constraint platform_users_identity_provider check(auth_provider in ('supabase','neon'));
create unique index platform_users_identity on public.platform_users(auth_provider,auth_subject) where auth_subject is not null;
