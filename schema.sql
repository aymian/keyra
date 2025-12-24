-- Create a table for public profiles if it doesn't exist
create table if not exists public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone,

  primary key (id)
);

-- Create a table for OAuth Clients
create table if not exists public.clients (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    name text not null,
    website text,
    redirect_uri text not null, -- For simplicity, single URI. In prod, array.
    client_id text unique not null,
    client_secret text not null,
    created_at timestamp with time zone default now()
);

-- Turn on Row Level Security (safe to run multiple times)
alter table public.profiles enable row level security;
alter table public.clients enable row level security;

-- Policies: Drop first to ensure cleanliness on re-run
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Clients Policies
drop policy if exists "Users can view their own clients." on clients;
create policy "Users can view their own clients."
  on clients for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own clients." on clients;
create policy "Users can insert their own clients."
  on clients for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can delete their own clients." on clients;
create policy "Users can delete their own clients."
  on clients for delete
  using ( auth.uid() = user_id );

-- Public read access for OAuth validation (or use Service Role in backend)
-- We'll use Service Role in backend to validate, so no public read needed.

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing; -- Handle potential conflict if profile exists
  return new;
end;
$$;

-- Trigger: Drop first to avoid "already exists" error
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
