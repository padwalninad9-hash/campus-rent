-- Rentify geolocation / "near me" search
-- Run once in Supabase SQL Editor, after schema.sql.
--
-- Uses plain numeric lat/lng + a Haversine SQL function instead of PostGIS —
-- no extension needs enabling, and Haversine is plenty accurate at
-- city/campus scale. If this project's Supabase tier already has PostGIS on,
-- it's still fine to leave this as-is; it only adds two nullable columns.

alter table public.items add column if not exists latitude numeric(9,6);
alter table public.items add column if not exists longitude numeric(9,6);

-- Speeds up the bounding-box pre-filter inside nearby_listings() below.
create index if not exists items_lat_lng_idx on public.items(latitude, longitude);

-- Great-circle distance in km between two lat/lng points.
create or replace function public.haversine_km(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
parallel safe
as $$
  select 6371 * acos(
    least(1, greatest(-1,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  )
$$;

-- Returns available, geolocated items within p_radius_km of (p_lat, p_lng),
-- nearest first. Public (anon + authenticated) since browsing doesn't
-- require login elsewhere in the app.
create or replace function public.nearby_listings(
  p_lat numeric,
  p_lng numeric,
  p_radius_km numeric default 10
)
returns table (
  id uuid,
  title text,
  description text,
  price_per_day numeric,
  deposit numeric,
  location text,
  latitude numeric,
  longitude numeric,
  category_id int,
  is_available boolean,
  created_at timestamptz,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  -- A degree of latitude is ~111km; padding the bounding box by radius/111
  -- lets Postgres use the lat/lng index before the exact Haversine check.
  select
    i.id, i.title, i.description, i.price_per_day, i.deposit, i.location,
    i.latitude, i.longitude, i.category_id, i.is_available, i.created_at,
    public.haversine_km(p_lat, p_lng, i.latitude, i.longitude) as distance_km
  from public.items i
  where i.is_available = true
    and i.latitude is not null
    and i.longitude is not null
    and i.latitude between p_lat - (p_radius_km / 111.0) and p_lat + (p_radius_km / 111.0)
    and i.longitude between p_lng - (p_radius_km / (111.0 * cos(radians(p_lat)))) and p_lng + (p_radius_km / (111.0 * cos(radians(p_lat))))
    and public.haversine_km(p_lat, p_lng, i.latitude, i.longitude) <= p_radius_km
  order by distance_km asc;
$$;

grant execute on function public.haversine_km(numeric, numeric, numeric, numeric) to anon, authenticated;
grant execute on function public.nearby_listings(numeric, numeric, numeric) to anon, authenticated;
