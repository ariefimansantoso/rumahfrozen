# Rumah Frozen 
based on Storify on Code Canyon

Storify is a full-featured, multi-vendor e-commerce marketplace built with
**Next.js 16**, **React 19**, **TypeScript**, **MongoDB/Mongoose**, and
**Tailwind CSS**. It ships with a storefront, customer accounts, vendor
dashboards, a full admin panel, staff roles, multiple payment gateways,
AI-powered tools, PWA/web-push notifications, internationalization (17
languages), and 3D product media.

This document is a complete guide to installing, configuring, running, and
deploying Storify.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [⚠️ External Service Costs & Subscriptions](#️-external-service-costs--subscriptions)
3. [Requirements](#requirements)
4. [Quick Start](#quick-start)
5. [Step-by-Step Installation](#step-by-step-installation)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Database: Seeding & Resetting](#database-seeding--resetting)
8. [Default Accounts](#default-accounts)
9. [Admin Panel Configuration](#admin-panel-configuration)
10. [Integration Setup Guides](#integration-setup-guides)
11. [Internationalization (i18n)](#internationalization-i18n)
12. [Available Scripts](#available-scripts)
13. [Project Structure](#project-structure)
14. [Production Deployment](#production-deployment)
15. [Troubleshooting](#troubleshooting)
16. [Tech Stack](#tech-stack)
17. [License](#license)

---

## Feature Overview

- **Storefront** — product catalog, search, filtering, cart, checkout, blog,
  and CMS-style content pages.
- **Customer accounts** — orders, addresses, wishlists, returns/refunds,
  2FA-secured login.
- **Vendor dashboards** — product management, orders, payouts, staff
  management, and vendor-scoped settings.
- **Admin panel** — full control over catalog, orders, users, vendors,
  settings, payments, analytics, and notifications.
- **Staff roles** — granular, permission-based access within vendor and admin
  contexts.
- **Payments** — Stripe, PayPal, Paystack, and Razorpay.
- **AI tools** — AI assistant, AI sales agent, and content generation
  (OpenAI).
- **Notifications** — transactional email (SMTP) and web-push (PWA).
- **Internationalization** — 17 languages with RTL support.
- **3D product media** — `@google/model-viewer` for `.glb`/`.gltf` models.

---

## ⚠️ External Service Costs & Subscriptions

Some features integrate with **third-party services that may charge usage fees
or require a paid subscription**. These are optional and only active when you
configure them:

- **AI-powered tools** (AI assistant, AI sales agent, content generation) use
  the **OpenAI API**, which is **billed per token by OpenAI**. See
  <https://openai.com/api/pricing/>. You must supply your own `OPENAI_API_KEY`.
- **Plausible Analytics** integration requires access to a **Plausible
  Analytics** account/instance (a paid SaaS subscription or a self-hosted
  deployment). Configured from **Admin → Settings → Analytics**.
- **Payment gateways** (Stripe, PayPal, Paystack, Razorpay) charge
  **per-transaction fees** according to each provider's pricing.
- **Object storage** (AWS S3, Cloudflare R2, or S3-compatible) may incur
  storage and bandwidth fees per the provider's pricing.

You are responsible for any costs incurred by these external services.

---

## Requirements

| Tool        | Version                       | Notes                                              |
| ----------- | ----------------------------- | -------------------------------------------------- |
| **Node.js** | `>= 20.19.28`                 | See the `engines` field in `package.json`.         |
| **pnpm**    | `10.24.0`                     | `corepack enable` is the recommended way to get it. |
| **MongoDB** | 6 / 7                         | Local instance or hosted (e.g. MongoDB Atlas).     |
| **Git**     | any                           | To clone/manage the source.                        |

> **Why pnpm?** This project pins `packageManager` to `pnpm@10.24.0` and uses a
> `pnpm-lock.yaml`. Using npm or yarn may produce an inconsistent dependency
> tree. Enable the pinned version with:
>
> ```bash
> corepack enable
> corepack prepare pnpm@10.24.0 --activate
> ```

---

## Quick Start

For experienced users, here is the whole flow in one block:

```bash
# 1. Install dependencies
corepack enable
pnpm install

# 2. Configure environment
cp .env.example .env
# …then edit .env (see the Environment Variables Reference below)

# 3. Seed the database (optional sample data)
pnpm db:seed          # catalog + settings
pnpm db:seed:users    # sample admin/vendor/staff/customer accounts

# 4. Create your own admin (if you didn't seed users)
pnpm create-admin you@example.com

# 5. Run
pnpm dev              # → http://localhost:3000
```

The rest of this document explains each step in detail.

---

## Step-by-Step Installation

### 1. Install dependencies

```bash
corepack enable          # ensures the pinned pnpm version is used
pnpm install
```

This installs all dependencies and runs approved build scripts (`sharp`,
`esbuild`, `@swc/core`, etc.) listed under `pnpm.onlyBuiltDependencies` in
`package.json`.

### 2. Set up MongoDB

You need a running MongoDB instance. Pick **one** of:

- **Local (Docker)** — quickest for development:

  ```bash
  docker run -d --name storify-mongo -p 27017:27017 mongo:7
  ```

  Then use `MONGODB_URI=mongodb://localhost:27017/storify`.

- **Local (native install)** — install MongoDB Community Server and start the
  `mongod` service.

- **Hosted (MongoDB Atlas)** — create a free cluster at
  <https://www.mongodb.com/atlas>, add your IP to the network access list,
  create a database user, and copy the connection string into `MONGODB_URI`.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values. The **minimum required** variables to boot
the app are:

| Variable             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `MONGODB_URI`        | MongoDB connection string.                                     |
| `MONGODB_DB_NAME`    | Database name (e.g. `storify`).                                |
| `BETTER_AUTH_SECRET` | Random 32+ char secret. Generate: `openssl rand -base64 32`.   |
| `BETTER_AUTH_URL`    | Base auth URL — `http://localhost:3000` in dev.                |
| `NEXT_PUBLIC_APP_URL`| Public app URL — `http://localhost:3000` in dev.               |

Everything else (SMTP, payments, AI, web push, storage) is optional and only
needed for the features you intend to use. See the
[full reference](#environment-variables-reference) below.

### 4. Seed the database (optional)

Populate sample catalog, settings, and demo users so you have something to look
at immediately:

```bash
pnpm db:seed          # catalog + default settings
pnpm db:seed:users    # admin / vendor / staff / customer demo accounts
```

> If you only want a clean install with your own admin account, skip
> `db:seed:users` and use `pnpm create-admin` in the next step instead.

### 5. Create an admin account

If you did **not** run `pnpm db:seed:users` (or want a custom admin):

```bash
pnpm create-admin <email> [password] [name]

# Example
pnpm create-admin admin@your-store.com
```

The email is required. If the password or name arguments are omitted, the
script falls back to `ADMIN_PASSWORD` / `ADMIN_NAME` from `.env`; if no
password is available at all, a random one is generated and printed. Running
it with the email of an existing user upgrades that user to admin.

### 6. Run the development server

```bash
pnpm dev
```

Open <http://localhost:3000>. Key entry points:

- **Storefront** — `http://localhost:3000/en`
- **Admin panel** — `http://localhost:3000/en/admin`
- **Vendor dashboard** — `http://localhost:3000/en/vendor`
- **Staff dashboard** — `http://localhost:3000/en/staff`

(`en` is the default locale — see [Internationalization](#internationalization-i18n).)

---

## Environment Variables Reference

All variables live in `.env` (copied from `.env.example`). Variables prefixed
with `NEXT_PUBLIC_` are exposed to the browser.

> **Two sources of config:** integration credentials (payments, OAuth/social
> login, SMTP, storage, analytics) can be set either in `.env` **or** in
> **Admin → Settings**. A value saved in Settings (database) always wins; the
> matching `.env` variable is the per-field fallback. This lets you boot from
> `.env` and later override individual fields from the UI.

### Database (required)

| Variable          | Example                                            | Description                |
| ----------------- | -------------------------------------------------- | -------------------------- |
| `MONGODB_URI`     | `mongodb://localhost:27017/storify?...`            | MongoDB connection string. |
| `MONGODB_DB_NAME` | `storify`                                          | Database name.             |

### Authentication — Better Auth (required)

| Variable             | Example                       | Description                                       |
| -------------------- | ----------------------------- | ------------------------------------------------- |
| `BETTER_AUTH_SECRET` | `…32+ random chars…`          | Signing secret. `openssl rand -base64 32`.        |
| `BETTER_AUTH_URL`    | `http://localhost:3000`       | Base URL Better Auth uses for callbacks.          |

### OAuth / Social login (optional)

Also configurable in **Admin → Settings → OAuth**. When credentials are
supplied via `.env` only, the provider is enabled automatically without
toggling it on in the Admin panel.

| Variable               | Description                  |
| ---------------------- | ---------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID.      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret.  |
| `FACEBOOK_APP_ID`      | Facebook app ID.             |
| `FACEBOOK_APP_SECRET`  | Facebook app secret.         |

### App configuration (required)

| Variable                        | Example                  | Description                                       |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`  | Public-facing app URL.                            |
| `NEXT_PUBLIC_APP_NAME`          | `Storify`                | Brand name shown in the UI.                       |
| `NEXT_PUBLIC_SUPPORT_EMAIL`     | `support@example.com`    | Support contact email.                            |
| `DEMO_MODE`                     | `false`                  | Set to `true` on public demos to make admin settings read-only and block settings uploads/deletes/test actions. |
| `NEXT_PUBLIC_ENABLE_PWA_IN_DEV` | `false`                  | Enable the PWA/service worker in local dev.       |

> Multi-vendor marketplace mode is toggled at runtime from **Admin → Settings
> → Multi-vendor** (stored in the database), not via an environment variable.

### Initial admin account (fallbacks for `pnpm create-admin`)

Used when the optional `[password]` / `[name]` arguments are omitted from
`pnpm create-admin <email> [password] [name]`.

| Variable           | Example                | Description                                  |
| ------------------ | ---------------------- | -------------------------------------------- |
| `ADMIN_NAME`       | `Admin`                | Display name for the created admin.          |
| `ADMIN_PASSWORD`   | `change-me`            | Password for the created admin.              |

### OpenAI — AI assistant / content tools (optional)

| Variable                 | Description                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`         | API key for AI features. **Billed per token by OpenAI.** Leave blank to disable.                                                                       |
| `AI_HERO_BANNER_ENABLED` | Set to `true` to enable admin Hero banner generation. Requires `OPENAI_API_KEY`; defaults to disabled and does not affect other AI authoring features. |

### Web Push notifications (optional)

Generate the key pair with `pnpm push:keys`, then set:

| Variable                          | Description                                            |
| --------------------------------- | ------------------------------------------------------ |
| `WEB_PUSH_PUBLIC_KEY`             | VAPID public key.                                      |
| `WEB_PUSH_PRIVATE_KEY`            | VAPID private key.                                     |
| `WEB_PUSH_SUBJECT`                | `mailto:` contact for push service (e.g. admin email). |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | Same public key, exposed to the browser.               |

### Email / SMTP (required for transactional emails)

| Variable    | Example                              | Description                |
| ----------- | ------------------------------------ | -------------------------- |
| `SMTP_HOST` | `smtp.example.com`                   | SMTP server host.          |
| `SMTP_PORT` | `587`                                | SMTP port.                 |
| `SMTP_USER` | `your-smtp-username`                 | SMTP username.             |
| `SMTP_PASS` | `your-smtp-password`                 | SMTP password.             |
| `SMTP_FROM` | `"Storify <no-reply@example.com>"`   | Default "From" address.    |

### Payment gateways (optional)

Configure only the providers you use. **Each charges transaction fees.**

**Stripe** — <https://stripe.com/pricing>

| Variable                              | Description                |
| ------------------------------------- | -------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  | Publishable (browser) key. |
| `STRIPE_SECRET_KEY`                   | Secret (server) key.       |
| `STRIPE_WEBHOOK_SECRET`               | Webhook signing secret.    |

**PayPal** — <https://www.paypal.com/us/webapps/mpp/merchant-fees>

| Variable               | Description                |
| ---------------------- | -------------------------- |
| `PAYPAL_CLIENT_ID`     | PayPal client ID.          |
| `PAYPAL_CLIENT_SECRET` | PayPal client secret.      |
| `PAYPAL_WEBHOOK_ID`    | PayPal webhook ID (used to verify webhook events). |

**Paystack** — <https://paystack.com/pricing>

| Variable                          | Description                |
| --------------------------------- | -------------------------- |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Public (browser) key.      |
| `PAYSTACK_PUBLIC_KEY`             | Public key (server).       |
| `PAYSTACK_SECRET_KEY`             | Secret key.                |

**Razorpay** — <https://razorpay.com/pricing/>

| Variable                        | Description                |
| ------------------------------- | -------------------------- |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`   | Key ID (browser).          |
| `RAZORPAY_KEY_ID`               | Key ID (server).           |
| `RAZORPAY_KEY_SECRET`           | Key secret.                |
| `RAZORPAY_WEBHOOK_SECRET`       | Webhook signing secret.    |

### Object storage (optional)

Works with AWS S3, Cloudflare R2, or any S3-compatible provider. Also
configurable from **Admin → Settings → Storage** (database values override
these per field).

- **Cloudflare R2:** set `STORAGE_ENDPOINT` to the R2 S3 API endpoint
  (`https://<account-id>.r2.cloudflarestorage.com`) and `STORAGE_REGION=auto`.
- **AWS S3:** set `STORAGE_REGION` (e.g. `us-east-1`) and leave
  `STORAGE_ENDPOINT` blank.

| Variable                    | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `STORAGE_ACCESS_KEY_ID`     | Access key ID.                                               |
| `STORAGE_SECRET_ACCESS_KEY` | Secret access key.                                           |
| `STORAGE_ACCOUNT_ID`        | Account ID (Cloudflare R2 only).                             |
| `STORAGE_ENDPOINT`          | S3 API endpoint (R2 / S3-compatible; blank for AWS S3).      |
| `STORAGE_REGION`            | Region (`auto` for R2, e.g. `us-east-1` for AWS).            |
| `STORAGE_BUCKET`            | Bucket name.                                                 |
| `STORAGE_PUBLIC_URL`        | Public base URL / CDN for serving uploaded files.            |
| `CLOUDFLARE_R2_PUBLIC_URL`  | Legacy fallback for the R2 public URL (if `STORAGE_PUBLIC_URL` is unset). |

### Analytics / tracking (optional)

Also configurable from **Admin → Settings → Analytics**. The `NEXT_PUBLIC_*`
IDs are exposed to the browser for client-side tracking scripts.

| Variable                        | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_GA_ID`             | Google Analytics measurement ID (`G-…`).               |
| `NEXT_PUBLIC_GTM_ID`            | Google Tag Manager container ID (`GTM-…`).             |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Facebook (Meta) Pixel ID.                              |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID`   | TikTok Pixel ID.                                       |
| `PLAUSIBLE_API_KEY`             | Plausible API key (server-side; admin analytics dashboard). |

---

## Database: Seeding & Resetting

| Command               | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `pnpm db:seed`        | Seeds sample catalog and default settings.                  |
| `pnpm db:seed:users`  | Seeds demo accounts (admin/vendor/staff/customer).          |
| `pnpm db:reset`       | **Drops/resets** the database. Destructive.                 |
| `pnpm db:full-reset`  | Resets, then re-seeds the catalog & settings.               |

> ⚠️ `db:reset` and `db:full-reset` are destructive — they wipe data. Never run
> them against a production database.

See `docs/DATABASE_COMMANDS.md` and `docs/SEED_VERIFICATION.md` for more detail.

---

## Default Accounts

Running `pnpm db:seed:users` creates these demo accounts. **Change or remove
them before going to production.**

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | `admin@storify.com`    | `Admin@123`    |
| Vendor   | `vendor@storify.com`   | `Vendor@123`   |
| Staff    | `staff@storify.com`    | `Staff@123`    |
| Customer | `customer@storify.com` | `Customer@123` |

---

## Admin Panel Configuration

Many settings are managed at runtime through the admin UI and stored in the
database (not `.env`). After logging in as an admin, visit **Admin → Settings**:

- **Storage** — connect AWS S3 / Cloudflare R2 / S3-compatible buckets for
  media uploads.
- **Payments** — enable/disable gateways and toggle test/live mode.
- **Email / Notifications** — configure transactional email and
  per-event/admin notification preferences.
- **Analytics** — connect a Plausible Analytics instance.
- **Multi-vendor** — toggle marketplace mode
  (`settings.multiVendorMode.enabled`). This is the only switch for
  multi-vendor mode; there is no environment variable for it.

---

## Integration Setup Guides

### Web Push (PWA notifications)

1. Generate a VAPID key pair:

   ```bash
   pnpm push:keys
   ```

2. Copy the printed public/private keys into `WEB_PUSH_PUBLIC_KEY`,
   `WEB_PUSH_PRIVATE_KEY`, and `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`.
3. Set `WEB_PUSH_SUBJECT` to a `mailto:` address.
4. To test the PWA/service worker locally, set
   `NEXT_PUBLIC_ENABLE_PWA_IN_DEV=true`.

### Stripe webhooks

Point your Stripe webhook endpoint at `/<your-app-url>/api/payments/webhook`
and put the signing secret in `STRIPE_WEBHOOK_SECRET`. For local testing, use
the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/payments/webhook
```

### OpenAI (AI features)

Set `OPENAI_API_KEY`. Leaving it blank disables the AI assistant, AI sales
agent, and AI content generation without breaking the rest of the app.
**Usage is billed per token by OpenAI.**

Hero banner generation has an independent kill switch: set
`AI_HERO_BANNER_ENABLED=true` after configuring `OPENAI_API_KEY`. Turning the
switch off leaves Product, Category, Collection, Brand, and Blog AI Studio
features unchanged.

---

## Internationalization (i18n)

Storify ships with **17 locales** (config in `config/i18n.config.ts`,
translations in `locales/*.json`). The default locale is **`en`**, and Arabic
(`ar`) renders right-to-left.

| Code | Language        | Code | Language          | Code | Language        |
| ---- | --------------- | ---- | ----------------- | ---- | --------------- |
| `en` | English (US)    | `de` | German            | `af` | Afrikaans       |
| `bn` | Bengali         | `hi` | Hindi             | `sw` | Swahili         |
| `ar` | Arabic (RTL)    | `nl` | Dutch             | `ha` | Hausa           |
| `es` | Spanish         | `zh` | Chinese (Simpl.)  | `yo` | Yoruba          |
| `fr` | French          | `ja` | Japanese          | `ig` | Igbo            |
|      |                 | `zu` | Zulu              | `xh` | Xhosa           |

Routes are locale-prefixed (e.g. `/en/admin`, `/ar/admin`).

---

## Available Scripts

| Script                 | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `pnpm dev`             | Start the Next.js dev server.                     |
| `pnpm build`           | Production build.                                 |
| `pnpm start`           | Start the production server (after `build`).      |
| `pnpm lint`            | Run ESLint.                                       |
| `pnpm typecheck`       | Run the TypeScript compiler (no emit).            |
| `pnpm create-admin`    | Create an admin user.                             |
| `pnpm link-credential` | Link a credential account to a user.              |
| `pnpm db:seed`         | Seed catalog & settings.                          |
| `pnpm db:seed:users`   | Seed sample users.                                |
| `pnpm db:reset`        | Reset the database (destructive).                 |
| `pnpm db:full-reset`   | Reset, then re-seed.                              |
| `pnpm push:keys`       | Generate VAPID keys for web push.                 |

---

## Project Structure

```
.
├── app/                 # Next.js App Router
│   ├── [locale]/        # Locale-prefixed routes
│   │   ├── (auth)/      # Login, register, 2FA
│   │   ├── (store)/     # Storefront, blog, content pages
│   │   ├── admin/       # Admin panel
│   │   ├── vendor/      # Vendor dashboard
│   │   └── staff/       # Staff dashboard
│   └── api/             # Route handlers (payments, media, webhooks, …)
├── components/          # UI and feature components
├── config/             # App, branding, i18n, permissions config
├── docs/                # Internal docs & analysis
├── hooks/              # React hooks
├── lib/                # Server/client utilities, integrations
├── locales/            # i18n translation JSON (17 languages)
├── models/             # Mongoose models
├── providers/          # React context providers
├── public/             # Static assets, service worker
├── scripts/            # Admin/seed/reset CLI scripts
└── stores/             # Zustand state stores
```

---

## Production Deployment

1. Set **all required** environment variables for your production environment.
   In particular, `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must point to your
   production domain (HTTPS).
2. Use a strong, unique `BETTER_AUTH_SECRET`.
3. Use a managed/hardened MongoDB instance (e.g. Atlas) and a production
   `MONGODB_URI`.
4. Build and start:

   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   pnpm start
   ```

5. Configure provider webhooks (Stripe, Razorpay, etc.) to point at your
   production domain.
6. **Remove or change all default seed accounts** and any test API keys.

> **Node version:** ensure the production runtime uses Node `>= 20.19.28`.

---

## Troubleshooting

| Symptom                                    | Likely cause / fix                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| App won't boot / auth errors               | Missing `MONGODB_URI`, `BETTER_AUTH_SECRET`, or `BETTER_AUTH_URL` in `.env`.        |
| `MongoServerError` / connection refused    | MongoDB not running, wrong `MONGODB_URI`, or IP not allow-listed in Atlas.          |
| Wrong pnpm version / install mismatches    | Run `corepack enable && corepack prepare pnpm@10.24.0 --activate`.                  |
| AI features do nothing                     | `OPENAI_API_KEY` not set (this is expected if you don't use AI).                    |
| Emails not sending                         | Verify `SMTP_*` values; check provider auth and port (587 STARTTLS / 465 SSL).      |
| Push notifications not working             | Generate keys with `pnpm push:keys` and set all `WEB_PUSH_*` vars; HTTPS required.  |
| Service worker not active in dev           | Set `NEXT_PUBLIC_ENABLE_PWA_IN_DEV=true`.                                            |
| Payment webhooks not received              | Confirm the webhook URL and signing secret match your provider dashboard.           |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript
- **Database:** MongoDB · Mongoose
- **Auth:** Better Auth (sessions, 2FA)
- **UI:** Tailwind CSS · Radix UI · Lucide icons
- **Content/media:** TipTap (rich text) · Recharts · `@google/model-viewer` (3D)
- **Payments:** Stripe · PayPal · Paystack · Razorpay
- **i18n:** next-intl (17 languages, RTL)
- **Notifications:** Web Push (PWA) · Nodemailer (SMTP)
- **AI:** OpenAI
- **State:** Zustand · React Hook Form · Zod
- **Tooling:** ESLint

---

## License

Distributed under your CodeCanyon/Envato license. See the item license for
details.
