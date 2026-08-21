-- Rentify profile photos
-- Run this once in Supabase Dashboard -> SQL Editor.
-- This creates a public bucket so the member photo can be shown on listings.

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Users upload their own profile photos" on storage.objects;
create policy "Users upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own profile photos" on storage.objects;
create policy "Users update their own profile photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
