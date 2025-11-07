-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS policies
create policy "Users can view all profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Create items table
create table public.items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  condition text not null,
  seller_id uuid references auth.users(id) not null,
  seller_quoted_price numeric not null,
  selling_price numeric,
  final_payout numeric,
  repair_cost numeric,
  buyer_id uuid references auth.users(id),
  processed_by uuid references auth.users(id),
  status text not null default 'pending_valuation',
  current_branch text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on items
alter table public.items enable row level security;

-- Items RLS policies
create policy "Users can view items they sold or bought"
on public.items
for select
to authenticated
using (
  auth.uid() = seller_id 
  or auth.uid() = buyer_id
  or status in ('ready_to_sell', 'sold')
  or public.has_role(auth.uid(), 'official')
);

create policy "Users can insert their own items"
on public.items
for insert
to authenticated
with check (auth.uid() = seller_id);

create policy "Officials can update all items"
on public.items
for update
to authenticated
using (public.has_role(auth.uid(), 'official'));

create policy "Users can update their own pending items"
on public.items
for update
to authenticated
using (auth.uid() = seller_id and status = 'pending_valuation');

-- Create item_media table
create table public.item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade not null,
  file_path text not null,
  file_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on item_media
alter table public.item_media enable row level security;

-- Item media RLS policies
create policy "Users can view media for items they can see"
on public.item_media
for select
to authenticated
using (
  exists (
    select 1 from public.items
    where items.id = item_media.item_id
    and (
      items.seller_id = auth.uid()
      or items.buyer_id = auth.uid()
      or items.status in ('ready_to_sell', 'sold')
      or public.has_role(auth.uid(), 'official')
    )
  )
);

create policy "Users can insert media for their own items"
on public.item_media
for insert
to authenticated
with check (
  exists (
    select 1 from public.items
    where items.id = item_media.item_id
    and items.seller_id = auth.uid()
  )
);

create policy "Officials can manage all media"
on public.item_media
for all
to authenticated
using (public.has_role(auth.uid(), 'official'));

-- Create trigger function for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Add triggers for updated_at
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger handle_items_updated_at
  before update on public.items
  for each row
  execute function public.handle_updated_at();

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();