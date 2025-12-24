-- Table for storing WebAuthn authenticators (Passkeys)
create table if not exists public.authenticators (
    credential_id text primary key,
    user_id uuid references auth.users on delete cascade not null,
    public_key text not null,
    counter bigint default 0,
    transports text, -- Stored as comma-separated string or JSON array
    created_at timestamp with time zone default now(),
    last_used timestamp with time zone
);

-- Enable RLS
alter table public.authenticators enable row level security;

-- Policies
-- Users can view their own authenticators
create policy "Users can view their own authenticators" on public.authenticators
    for select using (auth.uid() = user_id);

-- Users can delete their own authenticators
create policy "Users can delete their own authenticators" on public.authenticators
    for delete using (auth.uid() = user_id);

-- Only service role can insert/update (backend verification required)
-- We don't want users inserting arbitrary keys directly via client-side API
create policy "Service role manages authenticators" on public.authenticators
    for all using ( auth.role() = 'service_role' );

-- Index for searching by user
create index idx_authenticators_user_id on public.authenticators(user_id);
