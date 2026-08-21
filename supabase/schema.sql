-- ============================================================
-- Rentify — Supabase schema
-- Run this in Supabase Studio → SQL Editor (once, top to bottom)
-- ============================================================

-- 1. PROFILES ---------------------------------------------------
-- Extends auth.users with public info. One row per user, created
-- automatically via trigger when someone signs up.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  location text,
  avatar_url text,
  rating_avg numeric(2,1) default 0,
  rating_count int default 0,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New user'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CATEGORIES ---------------------------------------------------
create table if not exists public.categories (
  id serial primary key,
  name text not null unique,
  slug text not null unique,
  icon text default '📦'
);

alter table public.categories enable row level security;
create policy "Categories are viewable by everyone"
  on public.categories for select using (true);

insert into public.categories (name, slug, icon) values
  ('Books & Notes', 'books', '📚'),
  ('Electronics & Gadgets', 'electronics', '🔌'),
  ('Cycles & Vehicles', 'vehicles', '🚲'),
  ('Sports & Fitness', 'sports', '🏸'),
  ('Costumes & Events', 'costumes', '🎭'),
  ('Tools & Instruments', 'tools', '🛠️'),
  ('Furniture & Room Stuff', 'furniture', '🪑'),
  ('Other', 'other', '📦')
on conflict (slug) do nothing;

-- 3. ITEMS ---------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id int references public.categories(id),
  title text not null,
  description text default '',
  price_per_day numeric(10,2) not null check (price_per_day > 0),
  deposit numeric(10,2) default 0,
  location text default '',
  is_available boolean default true,
  created_at timestamptz default now()
);

create index if not exists items_category_idx on public.items(category_id);
create index if not exists items_owner_idx on public.items(owner_id);

alter table public.items enable row level security;

create policy "Items are viewable by everyone"
  on public.items for select using (true);

create policy "Owners can insert their own items"
  on public.items for insert with check (auth.uid() = owner_id);

create policy "Owners can update their own items"
  on public.items for update using (auth.uid() = owner_id);

create policy "Owners can delete their own items"
  on public.items for delete using (auth.uid() = owner_id);

-- 4. ITEM IMAGES ---------------------------------------------------
create table if not exists public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  url text not null,
  sort_order int default 0
);

alter table public.item_images enable row level security;

create policy "Item images are viewable by everyone"
  on public.item_images for select using (true);

create policy "Owners can manage images of their own items"
  on public.item_images for all using (
    exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
  );

-- 5. BOOKINGS ---------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  renter_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_amount numeric(10,2) not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','confirmed','ongoing','completed','cancelled')),
  created_at timestamptz default now(),
  check (end_date >= start_date)
);

create index if not exists bookings_item_idx on public.bookings(item_id);
create index if not exists bookings_renter_idx on public.bookings(renter_id);
create index if not exists bookings_owner_idx on public.bookings(owner_id);

alter table public.bookings enable row level security;

create policy "Renter or owner can view their bookings"
  on public.bookings for select using (auth.uid() = renter_id or auth.uid() = owner_id);

create policy "Renter can create a booking"
  on public.bookings for insert with check (auth.uid() = renter_id);

create policy "Renter or owner can update booking status"
  on public.bookings for update using (auth.uid() = renter_id or auth.uid() = owner_id);

-- 6. PAYMENTS ---------------------------------------------------
-- Written only by the Edge Functions (service role), never directly by the client.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  razorpay_order_id text not null,
  razorpay_payment_id text,
  amount numeric(10,2) not null,
  status text not null default 'created'
    check (status in ('created','paid','failed','refunded')),
  created_at timestamptz default now()
);

alter table public.payments enable row level security;

create policy "Renter or owner can view related payments"
  on public.payments for select using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
    )
  );
-- no insert/update policy for clients: only the service-role key (Edge Functions) can write here.

-- 7. REVIEWS ---------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text default '',
  created_at timestamptz default now(),
  unique (booking_id, reviewer_id)
);

alter table public.reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

create policy "Reviewer can leave a review for their own booking"
  on public.reviews for insert with check (auth.uid() = reviewer_id);

-- keep profile rating_avg / rating_count in sync
create or replace function public.handle_new_review()
returns trigger as $$
begin
  update public.profiles
  set rating_count = rating_count + 1,
      rating_avg = round((((rating_avg * rating_count) + new.rating) / (rating_count + 1))::numeric, 1)
  where id = new.reviewee_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_created on public.reviews;
create trigger on_review_created
  after insert on public.reviews
  for each row execute procedure public.handle_new_review();

-- 8. PASSWORD CHANGE AUDIT --------------------------------------
-- Password values are never stored here. This is an audit trail so an
-- administrator can see how many accounts have changed their passwords.
create table if not exists public.password_change_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default now()
);

create index if not exists password_change_events_user_idx
  on public.password_change_events(user_id);

alter table public.password_change_events enable row level security;
-- No browser role may read or write audit events. Read the count in the
-- Supabase SQL Editor or with a service-role admin endpoint.

create or replace function public.log_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.users stores the password as a hash; this trigger only records an
  -- event after that hash changes and never exposes or copies it.
  if old.encrypted_password is distinct from new.encrypted_password then
    insert into public.password_change_events (user_id) values (new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute procedure public.log_password_change();

-- Admin reporting query (run in the Supabase SQL Editor):
-- select count(distinct user_id) as users_who_changed_password,
--        count(*) as total_password_changes
-- from public.password_change_events;

-- 9. STORAGE ---------------------------------------------------
-- Bucket for item photos. Public read, authenticated write to own folder.
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy "Item images are publicly readable"
  on storage.objects for select using (bucket_id = 'item-images');

create policy "Authenticated users can upload item images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'item-images');

create policy "Owners can delete their own uploaded images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'item-images' and owner = auth.uid());
