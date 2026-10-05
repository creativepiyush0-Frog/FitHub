# FIT HUB — Setup & Deployment Guide

This guide covers setting up your existing Supabase project, executing the safe reconciliation migration, and deploying the FitHub system.

---

## 1. Supabase Project Configuration

1. In your **Supabase Dashboard**, navigate to **Project Settings** -> **API**.
2. Copy your **Project URL** and **anon / public** key.
3. Set the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - (Optional) `SUPABASE_SERVICE_ROLE_KEY` (kept server-side only)

4. Under **Authentication** -> **Providers** -> **Email**:
   - Ensure Email provider is enabled.
   - For immediate athlete check-in without email verification delays, confirm that "Confirm email" is configured according to your gym's policy.

---

## 2. Safe Database Migration (Non-Destructive)

To reconcile your existing Supabase tables with the complete 44-table FitHub enterprise schema without dropping or overwriting existing users or data:

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Open the file:
   `/supabase/migrations/20261005000001_safe_additive_reconciliation.sql`
3. Execute the SQL script.

### What This Safe Migration Does:
- **Zero Data Loss**: Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`.
- **Preserves Existing Tables**: Reuses your existing `profiles`, `gyms`, `branches`, `memberships`, `attendance`, `classes`, etc.
- **Seeds Base Records**: Automatically creates default gym, branch, and membership plans *only* if the tables are empty.

---

## 3. Row-Level Security (RLS) Policies

All sensitive gym data is guarded by Row-Level Security:
- **Members**: Can only view and modify their own profile, attendance, goals, progress, and tickets.
- **Gym Admins**: Scoped strictly to their assigned franchise branch.
- **Super Admins**: Full platform visibility.
- **Role Escalation Block**: Normal members cannot alter their own `role` column.

---

## 4. Local Development & Testing

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run code linting and syntax verification:
   ```bash
   npm run lint
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 5. Android Native Application

The native Android app uses the same backend and Supabase data:
- Source location: `/app/src/main/java/com/example/`
- Compiled debug APK: `/.build-outputs/app-debug.apk`
- Room Local Database (`FitHubDatabase.kt`) acts as an offline cache, synchronizing with the central Supabase PostgreSQL ledger.
