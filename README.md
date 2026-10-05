# FIT HUB — Enterprise Gym Management Ecosystem

FIT HUB is a multi-tenant, athletic gym management application built with high-performance responsive web technology, server-side Google Gemini AI Fitness Coaching, and a native Android application powered by Jetpack Compose.

---

## Architecture Overview

```text
┌──────────────────────────────┐       ┌──────────────────────────────┐
│       Web Application        │       │     Android Native App       │
│  (Tailwind CSS + Athletic UI)│       │      (Jetpack Compose)       │
└──────────────┬───────────────┘       └──────────────┬───────────────┘
               │                                      │
               │ HTTP / REST Bearer JWT               │
               ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FIT HUB Node.js Backend                       │
│      - REST APIs (Auth, Member, Admin, Super Admin, Turnstile)      │
│      - Server-Side Google Gemini AI Fitness Coach                   │
│      - JWT Token & Session Verification Engine                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ @supabase/supabase-js
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Supabase PostgreSQL DB                        │
│      - Supabase Auth (Auto-confirm Email, JWT Bearer Sessions)      │
│      - 44-Table Enterprise Relational Schema                        │
│      - Row-Level Security (RLS) Tenant & Member Isolation           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Features

- **Multi-Role Portals**: Dedicated operational interfaces for `MEMBER`, `GYM_ADMIN`, and `SUPER_ADMIN`.
- **Clean New Member Onboarding**: Brand new accounts start in a pristine zero-state (0 plans, 0 days, 0 check-ins, 0 streaks) with zero demo/sample data pollution.
- **Turnstile QR Access**: Real-time gate validation and attendance check-in.
- **Workout & Nutrition**: Exercise routines, set/rep trackers, macro targets, and interactive water logger.
- **Body Metrics & PRs**: Weight, height, BMI, body measurements, and 1RM strength logs.
- **Group Fitness Booking**: Yoga, CrossFit, and Zumba session reservation with capacity checks.
- **CRM & Inventory**: Lead pipeline tracking and supplement stock management.
- **Billing & Invoices**: Itemized tax invoices with GST and safe test checkout (DEMO mode).
- **Audit Trails**: Immutable event logs for administrative actions.
- **Server-Side AI Coach**: Personalized fitness guidance powered by Gemini.

---

## Quickstart

### Prerequisites
- Node.js 18+
- Active Supabase Project

### Environment Variables
Configure the following in your environment:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # Server-side only (optional)
GEMINI_API_KEY=your-gemini-api-key # Optional for live AI responses
PORT=3000
```

### Installation & Run
```bash
npm install
npm start
```
The application runs on `http://localhost:3000`.
