# CampusRent

A campus rental marketplace — anyone can list an item, anyone can rent it by
the day, and payment happens through Razorpay. Built as:

- **Frontend** — React + Vite + Tailwind (`/frontend`)
- **Backend** — Supabase (Postgres + Auth + Storage) (`/supabase/schema.sql`)
- **Middleware** — Supabase Edge Functions that talk to Razorpay so your
  secret keys never touch the browser (`/supabase/functions`)

```
campus-rent/
├── supabase/
│   ├── schema.sql                     ← run once in Supabase SQL editor
│   └── functions/
│       ├── create-razorpay-order/     ← creates a Razorpay order (server-side amount)
│       ├── verify-razorpay-payment/   ← verifies the payment signature
│       └── razorpay-webhook/          ← backup confirmation from Razorpay itself
└── frontend/                          ← the actual website
```

## How it fits together

1. A user browses items (public, no login needed) → `items` + `item_images` tables.
2. They pick dates on an item page → a `bookings` row is created with
   `status = pending_payment`.
3. On the checkout page, the frontend calls the **create-razorpay-order**
   Edge Function. That function re-reads the price from the database (never
   trusts the browser), creates a Razorpay order, and returns just enough
   info to open Razorpay's Checkout widget.
4. After the user pays, Razorpay hands back a signature. The frontend sends
   it to **verify-razorpay-payment**, which recomputes the signature with
   your secret key and only then marks the booking `confirmed`.
5. **razorpay-webhook** is a safety net: even if the browser tab closes
   right after paying, Razorpay calls this URL directly so your database
   still ends up correct.

Your Razorpay secret key and Supabase service-role key live **only** inside
the Edge Functions — the frontend never sees them.

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → run it.
   This creates all tables, row-level security policies, the storage bucket
   for photos, and a trigger that auto-creates a profile on signup.
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key

## 2. Set up Razorpay

1. Create an account at [razorpay.com](https://razorpay.com) (test mode is fine to start).
2. Go to **Settings → API Keys** → generate a Key Id + Key Secret.
3. Go to **Settings → Webhooks** → add a webhook pointing to your
   `razorpay-webhook` function URL (you'll get this in step 3 below) →
   subscribe to `payment.captured` and `payment.failed` → set a webhook
   secret and save it.

## 3. Deploy the Edge Functions

Install the Supabase CLI, then from the project root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# secrets the functions need (never exposed to the browser)
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxx
supabase secrets set RAZORPAY_KEY_SECRET=xxxxxxxxxxxx
supabase secrets set RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxx
# optional — only needed if you wire up the risk-score cron job (see below)
supabase secrets set RISK_CRON_SECRET=some-long-random-string

supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy resolve-escrow
supabase functions deploy recalculate-risk-scores
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically —
you don't need to set those yourself.

Your webhook URL for step 2 will be:
`https://YOUR-PROJECT-REF.supabase.co/functions/v1/razorpay-webhook`

### Testing payments — Razorpay test mode credentials

With test API keys, Razorpay's Checkout widget never touches real money.
Use these on the Checkout page (a booking with a deposit runs this twice —
once for rent, once for the deposit):

- **Test card**: `4111 1111 1111 1111`, any future expiry, any 3-digit CVV,
  any name. OTP screen: enter `1221`.
- **Test UPI**: VPA `success@razorpay` (always succeeds) or
  `failure@razorpay` (always fails, useful for testing the failed-payment
  path) — no real UPI app needed, Razorpay's test mode accepts these
  directly.
- Full list of test instruments (netbanking, wallets, international cards):
  [Razorpay's test mode docs](https://razorpay.com/docs/payments/payments/test-mode/).

To test a **deposit refund**: complete a booking's two-leg payment, have
the owner mark it "ongoing" then "Mark returned" from **My Bookings** — that
calls `resolve-escrow` (`action: "complete"`), which issues a real Razorpay
test-mode refund for the deposit. To test a **dispute**, go to
**Escrow admin** as an admin account and use "Flag dispute" / "Resolve
dispute" on a held deposit instead.

## 4. Run the frontend

```bash
cd frontend
cp .env.example .env
# edit .env with your Supabase URL + anon key
npm install
npm run dev
```

Open the printed `localhost` URL.

## 5. Deploy to Vercel

This repo has `frontend/` and `supabase/` side by side, so Vercel needs to
know the app actually lives in `frontend/`:

1. Push this repo to GitHub (see below), then in Vercel: **Add New →
   Project** → import the repo.
2. Under **Configure Project → Root Directory**, set it to `frontend`.
   Vercel auto-detects the Vite framework preset from there — no build
   command changes needed. `frontend/vercel.json` already has the SPA
   rewrite (`/* → /index.html`) that client-side routing (React Router)
   needs, so deep links like `/catalog` or `/item/:id` won't 404.
3. Add environment variables (Project → Settings → Environment Variables),
   for both **Production** and **Preview**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These get baked in at build time (Vite convention), so set them *before*
   the first deploy — changing them later requires a redeploy, not just a
   restart.
4. Deploy. Once you have your `*.vercel.app` URL (or a custom domain), go to
   your Supabase project → **Authentication → URL Configuration** and add
   it to both **Site URL** and **Redirect URLs** — otherwise the
   email-confirmation and password-reset links (`AuthContext.jsx`'s
   `emailRedirectTo` / `resetPasswordForEmail`) will point at `localhost`
   and fail for anyone using the deployed site.

The Supabase Edge Functions (`supabase/functions/*`) are **not** part of
this Vercel deploy — they stay deployed to Supabase itself via
`supabase functions deploy`, same as in step 3 above, regardless of where
the frontend is hosted.

---

## What's already built

- Email/password auth (Supabase Auth), auto-creates a profile row
- Browse + search + filter by category (public, no login required)
- List an item with multiple photos (uploaded to Supabase Storage)
- Book an item by date range, with live price calculation
- Real Razorpay checkout, server-verified before a booking is confirmed
- "My listings" (toggle availability, delete) and "My bookings" (as renter
  and as owner)
- Editable profile with a rolling rating average (once you wire up a
  review UI — the `reviews` table and trigger are already in the schema)

## Natural next steps

- A review-submission UI once a booking is `completed` (table already exists)
- Owner-side "mark as returned" action to move a booking to `completed`
- Push/email notifications on new bookings (Supabase has a `pg_net` extension
  you can trigger from a Postgres trigger, or use Resend from an Edge Function)
- Image compression before upload for faster listing pages
