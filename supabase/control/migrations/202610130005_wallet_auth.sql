-- Optional BFF wallet authentication. No managed Auth schema or app-plane changes.
alter table public.platform_users alter column email drop not null;
alter table public.platform_users drop constraint platform_users_identity_provider;
alter table public.platform_users add constraint platform_users_identity_provider
  check(auth_provider in ('supabase','neon','solana'));
alter table public.platform_users add constraint platform_users_login_identity
  check((auth_provider='solana' and email is null and auth_subject is not null) or
        (auth_provider in ('supabase','neon') and email is not null));

create table public.wallet_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.platform_users(id),
  address text not null unique check(address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  state text not null default 'active' check(state in ('active','revoked')),
  created_at timestamptz not null default now(), revoked_at timestamptz,
  unique(user_id,id),
  check((state='active' and revoked_at is null) or (state='revoked' and revoked_at is not null))
);
create unique index wallet_credentials_one_active on public.wallet_credentials(user_id) where state='active';

alter table public.platform_sessions add column auth_method text not null default 'managed'
  check(auth_method in ('managed','solana'));
alter table public.platform_sessions add column wallet_credential_id uuid;
alter table public.platform_sessions add constraint platform_sessions_wallet_owner
  foreign key(user_id,wallet_credential_id) references public.wallet_credentials(user_id,id);
alter table public.platform_sessions add constraint platform_sessions_wallet_method
  check((auth_method='managed' and wallet_credential_id is null) or
        (auth_method='solana' and wallet_credential_id is not null and auth_token_ciphertext is null));
create index platform_sessions_wallet on public.platform_sessions(wallet_credential_id) where wallet_credential_id is not null;

create table public.wallet_auth_challenges (
  id uuid primary key, nonce text not null unique check(nonce ~ '^[A-Za-z0-9]{8,128}$'),
  address text not null check(address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  mode text not null check(mode in ('login','link')),
  origin text not null, message text not null,
  browser_token_hash text not null,
  user_id uuid references public.platform_users(id),
  session_id uuid references public.platform_sessions(id),
  created_at timestamptz not null, expires_at timestamptz not null, consumed_at timestamptz,
  check(expires_at>created_at and expires_at<=created_at+interval '5 minutes'),
  check((mode='login' and user_id is null and session_id is null) or
        (mode='link' and user_id is not null and session_id is not null))
);
create index wallet_auth_challenges_expiry on public.wallet_auth_challenges(expires_at);
alter table public.wallet_credentials enable row level security;
alter table public.wallet_auth_challenges enable row level security;
revoke all on public.wallet_credentials,public.wallet_auth_challenges from public;
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on public.wallet_credentials,public.wallet_auth_challenges from %I',browser_role);
    end if;
  end loop;
end $$;
