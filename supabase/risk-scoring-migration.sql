-- Rentify user risk & fraud scoring engine
-- Run once in Supabase SQL Editor, after schema.sql (and kyc-migration.sql,
-- since the score reads KYC status).

-- 1. ADMIN FLAG ---------------------------------------------------
-- No admin concept existed before this. Same manual pattern as KYC review:
-- after running this, flip your own row to true from the SQL Editor, e.g.
--   update public.profiles set is_admin = true where id = 'YOUR-USER-UUID';
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- profiles.is_admin must never be settable through the normal client update
-- path (the existing "Users can update their own profile" policy has no
-- column restriction, so without this a user could just PATCH their own
-- is_admin to true). Only a direct SQL Editor / service-role write can
-- change it; anything arriving with a JWT role gets silently reverted.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and coalesce(auth.role(), 'service_role') <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profiles_protect_is_admin on public.profiles;
create trigger on_profiles_protect_is_admin
  before update on public.profiles
  for each row execute procedure public.protect_is_admin();

-- 2. USER REPORTS ---------------------------------------------------
-- Nothing like this existed before — lets a renter or owner flag another
-- member; feeds the "reports against them" scoring factor.
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index if not exists user_reports_reported_idx on public.user_reports(reported_user_id);

alter table public.user_reports enable row level security;

create policy "Users can file a report as themselves"
  on public.user_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

create policy "Reporters can see their own reports"
  on public.user_reports for select to authenticated
  using (auth.uid() = reporter_id);

create policy "Admins can see all reports"
  on public.user_reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 3. RISK SCORES ---------------------------------------------------
create table if not exists public.user_risk_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  factors jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_risk_scores enable row level security;

create policy "Users can see their own risk score"
  on public.user_risk_scores for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can see every risk score"
  on public.user_risk_scores for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
-- No insert/update policy for clients: only recompute_risk_score() (security
-- definer, below) writes here — same "only trusted server code writes this
-- table" pattern the payments table already uses.

-- 4. THE SCORING ENGINE ---------------------------------------------------
-- Rule-based, weighted, explainable: every factor's raw signal and point
-- contribution is stored in `factors` so a risk score is never a black box.
-- Weights (of 100 practical max, clamped): account age 20, email
-- verification 15, KYC status 15, booking cancellation history 20, reports
-- against the user 20, booking velocity 10, payment failures 10.
create or replace function public.recompute_risk_score(p_user_id uuid)
returns public.user_risk_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  account_created timestamptz;
  email_verified boolean;
  kyc_status text;
  completed_count int;
  cancelled_count int;
  booking_history_points numeric;
  reports_count int;
  reports_points numeric;
  recent_bookings_count int;
  velocity_points numeric;
  failed_payments_count int;
  payment_points numeric;
  age_days numeric;
  age_points numeric;
  email_points numeric;
  kyc_points numeric;
  total_score numeric;
  level text;
  computed_factors jsonb;
  result public.user_risk_scores;
begin
  select u.created_at, (u.email_confirmed_at is not null)
    into account_created, email_verified
    from auth.users u
    where u.id = p_user_id;

  if account_created is null then
    raise exception 'No such user %', p_user_id;
  end if;

  select status into kyc_status from public.kyc_submissions where user_id = p_user_id;
  kyc_status := coalesce(kyc_status, 'not_submitted');

  select count(*) filter (where status = 'completed'),
         count(*) filter (where status = 'cancelled')
    into completed_count, cancelled_count
    from public.bookings
    where renter_id = p_user_id;

  select count(*) into reports_count
    from public.user_reports
    where reported_user_id = p_user_id;

  select count(*) into recent_bookings_count
    from public.bookings
    where renter_id = p_user_id and created_at > now() - interval '24 hours';

  select count(*) into failed_payments_count
    from public.payments pay
    join public.bookings b on b.id = pay.booking_id
    where b.renter_id = p_user_id and pay.status = 'failed';

  -- Account age: newer accounts are riskier.
  age_days := extract(epoch from (now() - account_created)) / 86400.0;
  age_points := case
    when age_days < 3 then 20
    when age_days < 7 then 15
    when age_days < 30 then 8
    when age_days < 90 then 3
    else 0
  end;

  email_points := case when email_verified then 0 else 15 end;

  kyc_points := case kyc_status
    when 'verified' then 0
    when 'pending' then 6
    when 'rejected' then 15
    else 12 -- not_submitted
  end;

  -- Cancellation rate among the renter's own resolved bookings.
  if completed_count + cancelled_count = 0 then
    booking_history_points := 5; -- no track record yet — mild, not zero
  else
    booking_history_points := round(20.0 * cancelled_count / (completed_count + cancelled_count));
  end if;

  reports_points := least(20, reports_count * 8);

  velocity_points := case
    when recent_bookings_count >= 5 then 10
    when recent_bookings_count >= 3 then 6
    when recent_bookings_count >= 2 then 3
    else 0
  end;

  payment_points := least(10, failed_payments_count * 4);

  total_score := least(100, greatest(0,
    age_points + email_points + kyc_points + booking_history_points
    + reports_points + velocity_points + payment_points
  ));

  level := case
    when total_score >= 65 then 'high'
    when total_score >= 35 then 'medium'
    else 'low'
  end;

  computed_factors := jsonb_build_object(
    'account_age', jsonb_build_object('days', round(age_days, 1), 'points', age_points, 'max', 20),
    'email_verified', jsonb_build_object('verified', email_verified, 'points', email_points, 'max', 15),
    'kyc_status', jsonb_build_object('status', kyc_status, 'points', kyc_points, 'max', 15),
    'booking_history', jsonb_build_object('completed', completed_count, 'cancelled', cancelled_count, 'points', booking_history_points, 'max', 20),
    'reports', jsonb_build_object('count', reports_count, 'points', reports_points, 'max', 20),
    'velocity', jsonb_build_object('bookings_last_24h', recent_bookings_count, 'points', velocity_points, 'max', 10),
    'payment_failures', jsonb_build_object('count', failed_payments_count, 'points', payment_points, 'max', 10)
  );

  insert into public.user_risk_scores (user_id, score, risk_level, factors, updated_at)
  values (p_user_id, total_score, level, computed_factors, now())
  on conflict (user_id) do update
    set score = excluded.score,
        risk_level = excluded.risk_level,
        factors = excluded.factors,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

-- Client code never calls this directly (it's driven by the triggers below
-- and the recalculate-risk-scores Edge Function using the service role),
-- but grant execute so the Edge Function's user-context calls also work.
grant execute on function public.recompute_risk_score(uuid) to authenticated, service_role;

-- 5. TRIGGERS: recalculate on the events that actually change the picture --
create or replace function public.trigger_recompute_own_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_risk_score(new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created_score on public.profiles;
create trigger on_profile_created_score
  after insert on public.profiles
  for each row execute procedure public.trigger_recompute_own_risk();

create or replace function public.trigger_recompute_renter_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_risk_score(new.renter_id);
  return new;
end;
$$;

drop trigger if exists on_booking_change_score on public.bookings;
create trigger on_booking_change_score
  after insert or update of status on public.bookings
  for each row execute procedure public.trigger_recompute_renter_risk();

create or replace function public.trigger_recompute_reported_user_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_risk_score(new.reported_user_id);
  return new;
end;
$$;

drop trigger if exists on_report_created_score on public.user_reports;
create trigger on_report_created_score
  after insert on public.user_reports
  for each row execute procedure public.trigger_recompute_reported_user_risk();

create or replace function public.trigger_recompute_kyc_user_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_risk_score(new.user_id);
  return new;
end;
$$;

drop trigger if exists on_kyc_status_change_score on public.kyc_submissions;
create trigger on_kyc_status_change_score
  after insert or update of status on public.kyc_submissions
  for each row execute procedure public.trigger_recompute_kyc_user_risk();

-- 6. GATING: high-risk renters need admin approval before a booking confirms
-- 'pending_review' sits between a paid-for booking and a confirmed one.
-- verify-razorpay-payment (Edge Function) routes into this status instead of
-- 'confirmed' when the renter's risk_level is 'high'; the admin dashboard
-- approves (-> confirmed) or rejects (-> cancelled) from there.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending_payment', 'pending_review', 'confirmed', 'ongoing', 'completed', 'cancelled'));

create policy "Admins can update any booking"
  on public.bookings for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- A pending_review booking has already been paid for, so its dates should
-- stay provisionally held too, not just confirmed/ongoing ones. Only touches
-- this if rental-availability-migration.sql was applied first.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'bookings_no_overlapping_active_rentals') then
    alter table public.bookings drop constraint bookings_no_overlapping_active_rentals;
    alter table public.bookings add constraint bookings_no_overlapping_active_rentals
      exclude using gist (
        item_id with =,
        daterange(start_date, end_date, '[]') with &&
      ) where (status in ('confirmed', 'ongoing', 'pending_review'));
  end if;
end $$;

-- One-time backfill so every existing user has a starting score.
do $$
declare u record;
begin
  for u in select id from public.profiles loop
    perform public.recompute_risk_score(u.id);
  end loop;
end $$;
