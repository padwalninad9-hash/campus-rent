-- Fixes a real bug: kyc_submissions only ever had SELECT + INSERT policies,
-- so a rejected user's resubmission always hit the user_id primary key and
-- failed with a raw duplicate-key error. This lets a user move their own
-- row from rejected back to pending — nothing else.
-- Run once in Supabase SQL Editor, after kyc-migration.sql.

drop policy if exists "Users can resubmit after rejection" on public.kyc_submissions;
create policy "Users can resubmit after rejection"
  on public.kyc_submissions for update to authenticated
  using (auth.uid() = user_id and status = 'rejected')
  with check (auth.uid() = user_id and status = 'pending');
