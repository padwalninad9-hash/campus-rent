-- Rentify rental availability and pre-order support.
-- Run once in Supabase SQL Editor after schema.sql.

create extension if not exists btree_gist;

-- Prevents a confirmed or active rental from occupying the same dates as another.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlapping_active_rentals'
  ) then
    alter table public.bookings add constraint bookings_no_overlapping_active_rentals
      exclude using gist (
        item_id with =,
        daterange(start_date, end_date, '[]') with &&
      ) where (status in ('confirmed', 'ongoing'));
  end if;
end $$;

-- Public, privacy-safe availability summary for a listing page.
create or replace function public.get_item_availability(p_item_id uuid)
returns table (
  is_currently_rented boolean,
  rented_until date,
  next_available_date date
)
language sql
stable
security definer
set search_path = public
as $$
  with active_bookings as (
    select start_date, end_date
    from public.bookings
    where item_id = p_item_id
      and status in ('confirmed', 'ongoing')
      and end_date >= current_date
  ), current_rental as (
    select max(end_date) as ends_on
    from active_bookings
    where start_date <= current_date
  )
  select
    (select ends_on is not null from current_rental),
    (select ends_on from current_rental),
    coalesce((select max(end_date) + 1 from active_bookings), current_date);
$$;

grant execute on function public.get_item_availability(uuid) to anon, authenticated;

-- Creates a pending-payment booking only after validating availability and price on the server.
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
      and status in ('confirmed', 'ongoing')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Those dates are already rented. Please choose dates after the current rental.';
  end if;

  insert into public.bookings (item_id, renter_id, owner_id, start_date, end_date, total_amount, status)
  values (
    rental_item.id,
    auth.uid(),
    rental_item.owner_id,
    p_start_date,
    p_end_date,
    ((p_end_date - p_start_date + 1) * rental_item.price_per_day) + coalesce(rental_item.deposit, 0),
    'pending_payment'
  ) returning * into created_booking;

  return created_booking;
end;
$$;

grant execute on function public.create_rental_booking(uuid, date, date) to authenticated;
