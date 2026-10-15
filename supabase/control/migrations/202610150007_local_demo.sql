-- Local BFF test identity; never a managed Auth user or wallet credential.
alter table public.platform_users drop constraint platform_users_identity_provider;
alter table public.platform_users add constraint platform_users_identity_provider
  check(auth_provider in ('supabase','neon','solana','local_demo'));
alter table public.platform_users drop constraint platform_users_login_identity;
alter table public.platform_users add constraint platform_users_login_identity
  check((auth_provider='solana' and email is null and auth_subject is not null) or
        (auth_provider='local_demo' and email is null and auth_subject is not null and auth_subject ~ '^[a-f0-9]{64}$') or
        (auth_provider in ('supabase','neon') and email is not null));
alter table public.platform_sessions drop constraint platform_sessions_auth_method_check;
alter table public.platform_sessions add constraint platform_sessions_auth_method_check
  check(auth_method in ('managed','solana','local_demo'));
alter table public.platform_sessions drop constraint platform_sessions_wallet_method;
alter table public.platform_sessions add constraint platform_sessions_wallet_method
  check((auth_method='managed' and wallet_credential_id is null) or
        (auth_method='solana' and wallet_credential_id is not null and auth_token_ciphertext is null) or
        (auth_method='local_demo' and wallet_credential_id is null and auth_token_ciphertext is null));
-- Existing private tables keep RLS and revoked browser grants unchanged.
