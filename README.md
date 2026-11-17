# MANAM.in — Multi-Couple Wedding Invitation, RSVP & UPI Moi Platform

`MANAM.in` (`manam.in`) is a zero-commission, privacy-first wedding invitation platform built with React, TypeScript, Vite, Tailwind CSS, Firebase Authentication (Google Sign-In), Cloud Firestore, and Vercel Serverless Functions (`/api`).

Each couple receives an isolated wedding site (`/wedding/:slug`) with customizable themes, guest RSVP management, room planning, and direct UPI Moi wishlists. Once a wedding concludes and its grace period ends, all personal wedding records can be permanently erased from `/super`.

---

## Architecture Overview

- **Frontend SPA**: React 19 + TypeScript + Vite + Tailwind CSS v4 (`src/`)
- **Serverless API**: Vercel Node.js functions using `firebase-admin` and `zod` (`api/`)
- **Database & Auth**: Cloud Firestore + Firebase Google Sign-In (`firestore.rules`, `firestore.indexes.json`)
- **Images**: Browser-compressed WebP data URLs stored via `src/lib/assetStore.ts` in `weddings/{slug}/assets` (no paid Firebase Storage required; easily swappable later)

---

## Step-by-Step Production & Staging Setup

### 1. Create Two Separate Firebase Projects
Create two Firebase projects in the [Firebase Console](https://console.firebase.google.com/):
1. **`manam-prod`** (for Vercel **Production** on `manam.in`)
2. **`manam-staging`** (for Vercel **Preview** / staging deployments)

For **each** project:
1. Enable **Cloud Firestore** (in Native mode).
2. Go to **Authentication -> Sign-in method -> Enable Google**.
3. Go to **Authentication -> Settings -> Authorized domains** and add:
   - For `manam-prod`: `manam.in` and `www.manam.in`
   - For `manam-staging`: your Vercel preview domain (e.g., `manam-git-main-yourorg.vercel.app`) and `localhost`

> **Optional `/__/auth/` Proxy Rewrites (Only if Sign-In Fails on Safari/ITP)**
> `signInWithPopup` works directly on `manam.in` once added to Authorized domains. Only if strict third-party cookie blocking in certain mobile browsers prevents popup completion, add a rewrite in `vercel.json` forwarding `/__/auth/(.*)` to `https://<your-project>.firebaseapp.com/__/auth/$1` and set `VITE_FIREBASE_AUTH_DOMAIN="manam.in"`.

### 2. Publish Firestore Rules & Indexes
Install the Firebase CLI (`npm i -g firebase-tools`) and deploy rules and indexes to both projects:

```bash
firebase login
firebase use manam-staging
firebase deploy --only firestore:rules,firestore:indexes

firebase use manam-prod
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Generate Service Account Credentials
For **each** project (`manam-prod` and `manam-staging`):
1. Open **Project Settings -> Service Accounts -> Generate new private key**.
2. Minify the downloaded JSON file to a single line (no unescaped newlines outside `\n` inside `private_key`).
3. Keep this JSON strictly in server-only Vercel environment variables. Never commit it or prefix it with `VITE_`.

### 4. Configure Optional Firebase App Check (Recommended)
1. Register your site in Google reCAPTCHA v3 and copy the **Site Key** and **Secret Key**.
2. In Firebase Console -> **App Check -> Apps**, register your web app with reCAPTCHA v3.
3. Add the public site key to `VITE_RECAPTCHA_SITE_KEY` in Vercel.

### 5. Set Environment Variables in Vercel (Production vs Preview)
In your Vercel Project -> **Settings -> Environment Variables**:

#### Client Variables (Set separately for **Production** -> `manam-prod` and **Preview** -> `manam-staging`)
| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Production / Preview | Web API Key from respective Firebase project |
| `VITE_FIREBASE_AUTH_DOMAIN` | Production / Preview | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Production / Preview | `<project-id>` |
| `VITE_FIREBASE_APP_ID` | Production / Preview | Web App ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Production / Preview | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Production / Preview | Sender ID |
| `VITE_FIREBASE_DATABASE_ID` | Production / Preview | `(default)` (or named Firestore DB ID) |
| `VITE_RECAPTCHA_SITE_KEY` | Production / Preview | Optional reCAPTCHA v3 site key |

#### Server-Only Variables (NEVER prefix with `VITE_`)
| Variable | Scope | Value |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Production / Preview | Single-line service account JSON for respective Firebase project |
| `SUPER_ADMIN_EMAIL` | Production / Preview | `jbackup025@gmail.com` |
| `CRON_SECRET` | Production / Preview | Strong 32+ char random secret (Vercel automatically passes `Authorization: Bearer <CRON_SECRET>` to `/api/cron/daily`) |
| `FIREBASE_DATABASE_ID` | Production / Preview | `(default)` (or named Firestore DB ID) |

### 6. Connect Custom Domain & Deploy
1. In Vercel -> **Settings -> Domains**, add `manam.in` (and redirect `www.manam.in` -> `manam.in`).
2. Deploy via `vercel --prod` or push to your Git main branch.
3. Verify `GET https://manam.in/api/health` returns `{"ok":true}`.

### 7. Create Your First Wedding
1. Navigate to `https://manam.in/super`.
2. Sign in with Google as `jbackup025@gmail.com`.
3. Click **New Wedding**, pick a unique slug (e.g., `ananya-karthik-2026`), set wedding & expiry dates, invite up to 3 couple Google emails, and select a starting theme.
4. Share `/wedding/<slug>/admin` with the couple so they can customize sections, upload images, configure their UPI IDs, and manage RSVPs.

> **Staging Demo Seed:** On non-production domains (not `manam.in`), `/super` provides a **Seed Staging Demo** button that creates `/wedding/demo` with sample data and no hardcoded UPI IDs.

---

## Local Development

```bash
npm install
npm run dev
```

Run security rules lint:
```bash
npx eslint firestore.rules
```
