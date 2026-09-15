-- Rentify payment gateway & deposit escrow engine
-- Run once in Supabase SQL Editor, after schema.sql and
-- rental-availability-migration.sql (this redefines create_rental_booking()
-- and the overlap-exclusion constraint from that file).
--
-- Splits a booking's charge into two Razorpay orders — rent and a
-- refundable deposit — and tracks the deposit through a held / released /
-- disputed / refunded state machine. Real escrow (money sitting with a
-- licensed aggregator) needs a licensed payment aggregator account, which is
-- out of reach for a college project — so the "hold" is simulated at the
-- app level: the deposit charge is real (via Razorpay test mode), but once
-- captured, Rentify's own database — not Razorpay — is the source of truth
-- for whether that money is still "held" or has been paid back out.

-- 1. Split rent vs. deposit on the payments table ------------------------
alter table public.payments add column if not exists type text not null default 'rent';
alter table public.payments drop constraint if exists payments_type_check;
alter table public.payments add constraint payments_type_check check (type in ('rent', 'deposit'));

-- Snapshot the deposit portion at booking time, same way total_amount
-- already snapshots the full price so a later change to items.deposit can't
-- retroactively change what an existing booking owes.
alter table public.bookings add column if not exists deposit_amount numeric(10,2) not null default 0;

create or replace function public.create_rental_booking(
  p_item_id uuid,
  p_start_date date,
  p_end_date date
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  rental_item public.items;
  created_booking public.bookings;
begin
  if auth.uid() is null then raise exception 'Please log in to create a booking'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Choose a valid rental date range';
  end if;
  if p_start_date < current_date then raise exception 'Rental dates cannot be in the past'; end if;

  select * into rental_item from public.items where id = p_item_id for update;
  if not found or not rental_item.is_available then raise exception 'This item is not available'; end if;
  if rental_item.owner_id = auth.uid() then raise exception 'You cannot rent your own item'; end if;

  if exists (
    select 1 from public.bookings
    where item_id = p_item_id
      and status in ('confirmed', 'ongoing', 'pending_review')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Those dates are already rented. Please choose dates after the current rental.';
  end if;

  insert into public.bookings (item_id, renter_id, owner_id, start_date, end_date, total_amount, deposit_amount, status)
  values (
    rental_item.id,
    auth.uid(),
    rental_item.owner_id,
    p_start_date,
    p_end_date,
    ((p_end_date - p_start_date + 1) * rental_item.price_per_day) + coalesce(rental_item.deposit, 0),
    coalesce(rental_item.deposit, 0),
    'pending_payment'
  ) returning * into created_booking;

  return created_booking;
end;
$$;

grant execute on function public.create_rental_booking(uuid, date, date) to authenticated;

-- 2. Escrow holds ---------------------------------------------------------
create table if not exists public.escrow_holds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  status text not null default 'held' check (status in ('held', 'released', 'refunded', 'disputed')),
  refund_amount numeric(10,2),
  resolution_note text,
  held_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.escrow_holds enable row level security;

create policy "Renter or owner can view their escrow holds"
  on public.escrow_holds for select to authenticated
  using (
    exists (
      select 1 from public.payments pay
      join public.bookings b on b.id = pay.booking_id
      where pay.id = payment_id and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

create policy "Admins can view every escrow hold"
  on public.escrow_holds for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
-- No insert/update policy for clients: only the resolve-escrow Edge
-- Function (service role) writes here, same pattern as payments.

-- A deposit's dates should be held provisionally the same way rent-paid
-- bookings are (this migration doesn't touch that constraint further — it
-- was already widened to include pending_review by risk-scoring-migration.sql).

-- 3. Admin read access on bookings & payments ------------------------------
-- Neither table ever got a general admin SELECT policy — bookings only has
-- "renter or owner can view", payments only "renter or owner of the related
-- booking". That's fine for a client acting on their own data, but it quietly
-- breaks two admin screens once RLS is in play: the risk dashboard's
-- "awaiting approval" panel (Module 2) only ever showed bookings the admin
-- happened to be the renter/owner of, and the escrow dashboard's nested
-- payments(...)/bookings(...) embeds here would come back null for every
-- hold that isn't the admin's own. Both need a real admin-wide read policy.
create policy "Admins can view every booking"
  on public.bookings for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admins can view every payment"
  on public.payments for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
