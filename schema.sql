-- Create a table for public profiles
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
    redirect_uri text not null,
    client_id text unique not null,
    client_secret text not null,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;

-- Policies (Profiles)
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles for select using ( true );

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using ( auth.uid() = id );

-- Policies (Clients)
drop policy if exists "Users can view their own clients." on clients;
create policy "Users can view their own clients." on clients for select using ( auth.uid() = user_id );

drop policy if exists "Users can insert their own clients." on clients;
create policy "Users can insert their own clients." on clients for insert with check ( auth.uid() = user_id );

drop policy if exists "Users can delete their own clients." on clients;
create policy "Users can delete their own clients." on clients for delete using ( auth.uid() = user_id );

-- User Signup Handler
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger for new users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert Default Client (Run this in Supabase SQL Editor while authenticated if you want it linked to your user, or manually replace auth.uid())
-- Note: auth.uid() returns null in non-authenticated context.
-- insert into public.clients (user_id, name, website, redirect_uri, client_id, client_secret)
-- values 
-- (auth.uid(), 'Keyra', 'https://keyra.com', 'http://localhost:3000/callback', 'kp_8669vtxaj8htjsuyeo0rw', 'ksec_62mvqkt33kvim9suqrl0tiljrreqehpml');
