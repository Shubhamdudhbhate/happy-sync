-- Create enum for roles
create type public.app_role as enum ('user', 'official');

-- Create user_roles table
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (user_id, role)
);

-- Enable RLS
alter table public.user_roles enable row level security;

-- Create security definer function to check roles (prevents RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- RLS Policies for user_roles table
-- Users can view their own roles
create policy "Users can view own roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

-- Officials can view all roles
create policy "Officials can view all roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'official'));

-- Allow new users to create their own initial role during signup
create policy "Users can create own initial role"
on public.user_roles
for insert
to authenticated
with check (
  auth.uid() = user_id 
  and not exists (
    select 1 from public.user_roles where user_id = auth.uid()
  )
);

-- Only officials can insert roles for others
create policy "Officials can insert roles"
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'official'));

-- Only officials can update roles
create policy "Officials can update roles"
on public.user_roles
for update
to authenticated
using (public.has_role(auth.uid(), 'official'));

-- Only officials can delete roles
create policy "Officials can delete roles"
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'official'));