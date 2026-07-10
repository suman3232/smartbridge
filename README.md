# OfferBridge

OfferBridge is a card-deal marketplace. **Shoppers** post a product they want at
a card-specific discount; **card holders** who own that card place the order,
ship it to the shopper, and earn a reimbursement plus commission. An **admin**
reviews deals, verifies KYC, and releases payouts.

Built with Vite + React + TypeScript + Tailwind + shadcn/ui, backed by Supabase
(Postgres, Auth, Storage, Row Level Security).

---

## How the flow works

1. **Shopper** posts a request: product link, the card offer price, the total
   they'll pay, the commission for the card holder, and a delivery address.
2. **Admin** approves it (a support contact number is auto-assigned round-robin).
   The deal becomes visible in **Browse Deals**.
3. **Card holder** accepts. Only then is the delivery address revealed to them
   (privacy by design). They place the order on Amazon/Flipkart/etc. using
   their own card and ship it to the shopper.
4. Once delivered and the shopper has paid, the **admin** completes the deal.
   The card holder's wallet is credited with **reimbursement + commission**.
5. Card holders submit **KYC** (PAN + bank details + ID document). After admin
   approval they can **withdraw** their wallet balance to their bank account.

Money movement uses an **admin-mediated wallet ledger** — no payment gateway is
required. Admins confirm real-world payment, then release wallet credit. A real
gateway (Razorpay/Stripe) can be layered on later.

---

## First-time setup

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

```sh
cp .env.example .env
```

Fill `.env` with your Supabase **Project URL** and **anon key**
(Supabase Dashboard → Project Settings → API).

### 3. Create the database

In the Supabase Dashboard → **SQL Editor** → New query, paste the entire
contents of [`supabase/setup.sql`](supabase/setup.sql) and click **Run**.

This is idempotent — it creates every table, enum, RLS policy, function,
trigger, and storage bucket, and is safe to re-run at any time. Running it also
reloads the PostgREST schema cache so the app can call the functions
immediately.

> If the app ever shows *"Could not find the function … in the schema cache"*,
> just re-run `setup.sql` — that reloads the cache.

### 4. Make yourself an admin

1. Start the app and **sign up once** with your email (so your account exists).
2. In the SQL Editor, open [`supabase/scripts/grant-admin.sql`](supabase/scripts/grant-admin.sql),
   replace `you@example.com` with your email, and run it.
3. **Sign out and back in** — the Admin Panel now appears in the sidebar.

### 5. Google login (fixing "Google login not working")

The app code is already correct (PKCE OAuth). Google failing is almost always
one of these three config items — set all three:

**a) Google Cloud Console** (<https://console.cloud.google.com> → APIs & Services
→ Credentials → your OAuth 2.0 Client):
- **Authorized redirect URIs** must include your Supabase callback:
  `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- **Authorized JavaScript origins** should include your app origin(s), e.g.
  `http://localhost:8080` and your production URL.
- If the OAuth consent screen is in **Testing**, add your Google account under
  **Test users** (otherwise Google blocks the sign-in).

**b) Supabase → Authentication → Providers → Google:** enable it and paste the
Client ID + Client Secret from (a).

**c) Supabase → Authentication → URL Configuration:**
- **Site URL** = your app origin (e.g. `http://localhost:8080` in dev).
- **Redirect URLs** must include `http://localhost:8080/**` (dev) and
  `https://your-domain/**` (prod). The wildcard covers `/auth`.

> The app redirects OAuth back to `<origin>/auth`. If the origin isn't in the
> allow-list, Supabase blocks the redirect. Make sure the port matches your dev
> server (`8080` by default).

### 5b. Email verification (6-digit OTP) — REQUIRED MANUAL CONFIG

The app has a full 6-digit OTP verification flow built in. **Google users are
verified automatically** and skip it. To turn it on for email/password users you
must change two Supabase settings (the app can't set these for you):

1. **Require confirmation.** Supabase → **Authentication → Providers → Email** →
   turn **"Confirm email" ON** (your project currently has auto-confirm on, i.e.
   no verification). This makes `signUp` withhold the session until the code is
   verified — which is what gates unverified users.

2. **Send a 6-digit code instead of a link.** Supabase → **Authentication →
   Email Templates → "Confirm signup"** → make the body use the token, e.g.:

   ```html
   <h2>Confirm your OfferBridge sign-up</h2>
   <p>Your verification code is:</p>
   <p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>This code expires shortly. If you didn't sign up, ignore this email.</p>
   ```

   The app calls `verifyOtp({ type: 'signup' })` with the entered code.

3. **(Production) Custom SMTP — recommended.** Supabase's built-in email is
   rate-limited to a few messages per hour. For real traffic, Supabase →
   **Authentication → Emails → SMTP Settings** and plug in a provider
   (**Resend**, **SendGrid**, **Amazon SES**, **Postmark** — all have free
   tiers). 🔑 *This is the one credential you'll want for reliable OTP delivery.*

**Server-side enforcement (already built):** unverified users are blocked at the
database from posting/accepting deals, submitting KYC, requesting withdrawals,
placing orders, and applying a referral — via `public.is_verified()` in RLS +
RPCs, not just hidden buttons. Existing users (created under auto-confirm) and
Google users are already verified, so enabling this won't lock anyone out.

> **E2E test note:** `scripts/e2e-test.mjs` needs to create sessions. With
> "Confirm email" ON, brand-new signups have no session until verified, so the
> harness reuses already-verified test accounts. To fully test the OTP path,
> verify manually in the browser, or create a pre-confirmed user with the
> service-role Admin API (`auth.admin.createUser({ email_confirm: true })`).

### 6. Replace the seed support numbers

`setup.sql` seeds placeholder support phone numbers into `admin_numbers`.
Update them to your real numbers:

```sql
update public.admin_numbers set is_active = false;           -- disable placeholders
insert into public.admin_numbers (phone_number, is_active) values ('+91 XXXXX XXXXX', true);
```

### 7. Run the app

```sh
npm run dev
```

Opens on <http://localhost:8080>.

---

## Price Tracker

Paste an Amazon / Flipkart / Myntra / AJIO / Meesho product link and the app
tracks its price over time, shows an interactive history chart + stats
(current / lowest / highest / average / recent change), and gives a
**data-driven** buy recommendation (Excellent / Good / Fair / Wait / Building).
You can set a **target price** and get an in-app notification when a recorded
price drops to or below it.

**Works with zero external setup:** the whole feature (storage, history graph,
stats, recommendations, watchlist, target alerts) runs on real prices you add or
log manually. Nothing is faked — history builds from the first price you record.

**Automatic price fetching (optional):** an Edge Function fetches live prices so
you don't have to log them by hand.

```sh
# 1) Deploy the function (needs the Supabase CLI + `supabase login`)
supabase functions deploy price-check --project-ref <PROJECT_REF>

# 2) (Recommended) set a scraper key for reliable Amazon/Flipkart data.
#    Free tier: https://www.scraperapi.com (1,000 requests/month).
supabase secrets set SCRAPER_API_KEY=<your-key> --project-ref <PROJECT_REF>

# 3) Set a shared secret so only the scheduler can trigger batch re-checks.
supabase secrets set CRON_SECRET=<any-random-string> --project-ref <PROJECT_REF>
```

- **Without** `SCRAPER_API_KEY` the function still tries a direct fetch +
  JSON-LD/OpenGraph parse — best-effort (works for many sites; Amazon often
  blocks un-proxied bots).
- **Scheduled re-checks:** after deploying, run
  [`supabase/scripts/schedule-price-checks.sql`](supabase/scripts/schedule-price-checks.sql)
  (edit the two placeholders) to re-check every product every 6 hours and fire
  target-price alerts.

If the function isn't deployed, the "Auto-fetch" button simply tells the user to
enter details manually — no crash, no fake data.

## Refer & Earn

Every user gets a unique **referral code** and short link (`/r/CODE`). A new user
who joins through the link is permanently attributed to the referrer **after
their email is verified** (the code is stored client-side and applied post-
verification, so it works for both email/password and Google signups).

- **No reward for signup.** Both rewards are credited only after the referred
  user's **first successfully completed deal** (as shopper *or* card holder) that
  meets the configurable minimum value — evaluated inside `complete_deal`, so
  cancelled/rejected/reversed deals never trigger a reward.
- **Configurable from the admin panel** (Referrals tab): referrer reward, welcome
  bonus, minimum qualifying amount, per-referrer cap, and an enable/pause switch.
  No amounts are hardcoded.
- **Anti-abuse:** self-referral blocked, one referral per referred user
  (`UNIQUE`), attribution only while the account is new, per-referrer cap,
  race-safe atomic qualification, KYC-gated withdrawal, and admin **void/reverse**
  (claw-back) for suspicious referrals.
- Rewards appear in **wallet history** (`referral_reward` / `welcome_bonus`) and
  **notifications**. Users get a **Refer & Earn** page with their code, link,
  totals, and history.

Fully implemented in `setup.sql` + the app — **no external credentials required.**

## Progressive Web App (PWA)

OfferBridge is an installable PWA (via `vite-plugin-pwa` + Workbox).

- **Install:** an **Install app** button appears in the header/navbar (and dashboard)
  only when the browser reports the app is installable, and hides once installed.
  On iOS Safari it opens **Add to Home Screen** guidance. Installs open in
  **standalone** mode with the OfferBridge icon.
- **Icons:** generated from the brand logo — `node scripts/gen-icons.mjs`
  (writes 192/512/maskable/apple-touch/favicon into `public/`).
- **Offline:** the app shell + assets are precached, so navigation and deep links
  (`/r/:code`, `/deals/:id`, OAuth returns) work offline; an offline banner shows
  when disconnected. Data pages fall back to their empty/error states offline.
- **Updates:** a **"New version available → Update"** prompt appears when a new
  build is deployed (no silent reloads).
- **Security:** the service worker **only** precaches public build assets and
  caches Google Fonts at runtime. **Supabase / API / auth / wallet / KYC and any
  protected data are never cached** — those requests always hit the network.

PWA features are active in production builds. Test locally with:

```sh
npm run build && npm run preview   # service worker runs on localhost
```

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server (port 8080)     |
| `npm run build`     | Production build                     |
| `npm run preview`   | Preview the production build         |
| `npm run lint`      | Run ESLint                           |
| `node scripts/e2e-test.mjs` | End-to-end + security verification against the live DB (run after `setup.sql`; email auto-confirm must be ON) |

---

## Project structure

```
src/
  pages/            Route pages (Landing, Auth, Dashboard, BrowseDeals,
                    CreateDeal, DealDetail, Wallet, KYC, Profile, AdminPanel, …)
  components/
    layout/         DashboardLayout, Navbar, PageLoader
    deals/          AcceptDealDialog
    ui/             shadcn/ui primitives + FileUpload
  contexts/         AuthContext (session, profile, admin role)
  integrations/
    supabase/       Generated client + database types
  lib/              supabase re-export, storage helpers, app-url, auth-errors
supabase/
  setup.sql         ← single idempotent database setup (run this)
  scripts/          grant-admin.sql (bootstrap first admin)
  migrations/       Historical migration files (setup.sql is the source of truth)
```

## Storage buckets

`setup.sql` creates two buckets:

- **`kyc-documents`** (private) — KYC ID uploads; readable only by the owner and
  admins (via signed URLs).
- **`order-screenshots`** (public) — order confirmation screenshots.

## Key database functions (RPC)

`approve_deal`, `reject_deal`, `accept_deal`, `place_deal_order`,
`complete_deal`, `list_open_deals`, `get_deal_accept_preview`,
`get_deal_for_viewer`, `approve_kyc`, `reject_kyc`, `list_kycs_for_admin`,
`request_withdrawal`, `complete_withdrawal`, `reject_withdrawal`,
`grant_admin_role`, `revoke_admin_role`, `list_admins`, `is_admin`.
