-- Rentify manual identity-verification MVP
-- Run this once in Supabase SQL Editor. Documents remain private.

create table if not exists public.kyc_submissions (
  user_id uuid primary key,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  identity_document_path text not null,
  selfie_path text not null,
  consent_given_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);

alter table public.kyc_submissions enable row level security;

create policy "Users read their own KYC status"
  on public.kyc_submissions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users submit their own KYC once"
  on public.kyc_submissions for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending');

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "Users upload only their own KYC documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read only their own KYC documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Admin review: use the Supabase SQL Editor (service role) after checking documents.
-- Example: update public.kyc_submissions set status = 'verified', reviewed_at = now()
-- where user_id = 'USER_UUID';
