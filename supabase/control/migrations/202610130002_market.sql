create table if not exists public.project_wallet_challenges (
  nonce text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.platform_users(id) on delete cascade,
  address text not null, message text not null,
  expires_at timestamptz not null, consumed_at timestamptz
);
create table if not exists public.project_wallet_bindings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references public.platform_users(id),
  address text not null, verified_at timestamptz not null default now()
);
create table if not exists public.markets (
  project_id uuid primary key references public.projects(id),
  address text not null unique, mint text not null unique, creator text not null,
  curve_vault text not null, locked_vault text not null,
  cluster text not null default 'devnet' check (cluster = 'devnet'),
  net_sold numeric(20,0) not null default 0,
  reserve_lamports numeric(20,0) not null default 0,
  status text not null default 'prepared' check (status in ('prepared','active')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.market_quotes (
  id uuid primary key, project_id uuid not null references public.markets(project_id),
  user_id uuid not null references public.platform_users(id),
  side text not null check (side in ('buy','sell')), token_amount numeric(20,0) not null check (token_amount > 0),
  lamports numeric(20,0) not null check (lamports > 0),
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.funding_intents (
  id uuid primary key, project_id uuid not null references public.projects(id),
  user_id uuid not null references public.platform_users(id),
  sender text not null, recipient text not null, reference text not null unique,
  lamports numeric(20,0) not null check (lamports > 0),
  status text not null default 'created' check (status in ('created','pending','confirmed','failed','expired')),
  signature text, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.solana_transactions (
  id uuid primary key, project_id uuid not null references public.projects(id),
  user_id uuid not null references public.platform_users(id),
  kind text not null check (kind in ('register','buy','sell','funding')),
  quote_id uuid references public.market_quotes(id), funding_intent_id uuid references public.funding_intents(id),
  cluster text not null default 'devnet' check (cluster = 'devnet'),
  signature text, ix_index integer not null,
  message_hash text not null unique, expected_signer text not null,
  expires_at timestamptz not null,
  status text not null default 'prepared' check (status in ('prepared','pending','confirmed','failed','expired')),
  error text, finalized_at timestamptz, recovery_cursor text, last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  unique(cluster, signature, ix_index), unique(cluster, signature)
);
alter table public.solana_transactions add column if not exists recovery_cursor text;
alter table public.solana_transactions add column if not exists last_scan_at timestamptz;
create index if not exists solana_pending_recovery on public.solana_transactions(status, created_at) where status = 'pending';
-- Browser clients cannot access control-plane financial tables; Express performs authorization.
alter table public.project_wallet_challenges enable row level security;
alter table public.project_wallet_bindings enable row level security;
alter table public.markets enable row level security;
alter table public.market_quotes enable row level security;
alter table public.funding_intents enable row level security;
alter table public.solana_transactions enable row level security;
revoke all on public.project_wallet_challenges, public.project_wallet_bindings, public.markets,
  public.market_quotes, public.funding_intents, public.solana_transactions from public;
-- Neon has no Supabase browser roles. Revoke those roles only when the optional adapter created them.
do $$
declare browser_role text;
begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on public.project_wallet_challenges, public.project_wallet_bindings, public.markets, public.market_quotes, public.funding_intents, public.solana_transactions from %I',browser_role);
    end if;
  end loop;
end $$;
