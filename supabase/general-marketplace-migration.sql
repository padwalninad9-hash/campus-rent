-- Run this only if you previously installed an older CampusRent schema.
-- It keeps existing data while converting the profile and KYC fields to Rentify's general-marketplace model.

alter table public.profiles add column if not exists location text;

do $$
begin
  -- Move any prior college value into the new generic location field.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'college'
  ) then
    update public.profiles set location = college where location is null and college is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kyc_submissions' and column_name = 'student_id_path'
  ) then
    alter table public.kyc_submissions rename column student_id_path to identity_document_path;
  end if;
end $$;
