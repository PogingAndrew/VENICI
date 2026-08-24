# FitTrack — Integrated Fitness & Nutrition Tracking System

## Updates since initial scaffold

- **Personal food library.** Any user can add their own custom foods
  (calories, protein, carbs, fat, fiber) via **Nutrition → My food library**.
  These are private to that user and show a "Personal" badge when searched
  while logging a meal. The shared, admin-managed database still works
  exactly as before — `Food.createdByUserId` is `null` for those entries.
- **Richer onboarding.** Registration is now two steps: account details,
  then a fitness profile — date of birth (age is derived from this and
  stays accurate over time instead of going stale), sex, height, activity
  level, current weight, and goal weight. This automatically creates the
  first body-weight measurement and an active goal, and unlocks BMI +
  daily calorie target on the Dashboard and Profile pages.

**This changed the database schema** (`Profile.age` → `Profile.dateOfBirth`,
new `Food.createdByUserId`). If you already ran migrations against an
existing database, run:

```bash
cd apps/api
npx prisma migrate dev --name personal-foods-and-dob
```

If that reports drift/conflicts on a throwaway dev database, the simplest
fix is `npx prisma migrate reset` (drops and rebuilds `stridewell` from the
schema, then reseeds).

A full-stack fitness and nutrition platform: auth, profiles, goals, nutrition
logging, a food database, strength workout tracking with an exercise
database, GPS-based cardio tracking (Leaflet + OpenStreetMap), a mock
wearable integration architecture, progress tracking with charts, weekly/
monthly reports, and an admin panel.

Built as the prototype/implementation artifact for an undergraduate thesis
on integrated fitness and nutrition tracking systems.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + React Router +
  Recharts + Leaflet/react-leaflet
- **Backend:** Node.js + Express + TypeScript, REST API
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT access + refresh tokens in httpOnly cookies, bcrypt password
  hashing, role-based access control (`USER` / `ADMIN`)

## Project layout

```
apps/
  api/    Express API, Prisma schema, seed script
  web/    React frontend (Vite)
docker-compose.yml   Local Postgres for development
```

See each module under `apps/api/src/modules/*` — one folder per domain
(auth, profile, goals, foods, meals, exercises, workouts, cardio, wearables,
progress, reports, admin), each with its own routes and, where useful, a
service file. Frontend pages under `apps/web/src/pages/*` mirror the same
domains and the sidebar nav in the spec.

## Getting started

### 1. Start PostgreSQL

```bash
docker compose up -d
```

Or point `DATABASE_URL` in `apps/api/.env` at any Postgres instance you
already have (Supabase, Neon, RDS, a local install, etc).

### 2. Set up the API

```bash
cd apps/api
cp .env.example .env       # edit JWT secrets if you like
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev                # http://localhost:4000
```

The seed script creates:
- 20 sample foods and 20 sample exercises
- A demo user: `demo@fittrack.dev` / `Demo1234!`
- An admin user: `admin@fittrack.dev` / `Admin1234!`
- Sample body-weight history and an active weight-loss goal for the demo user

### 3. Set up the frontend

```bash
cd apps/web
npm install
npm run dev                # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:4000`, so just open
`http://localhost:5173` and log in with the demo account above.

### 4. Try the GPS cardio tracker

Go to **Cardio → Start an activity**, pick an activity type, and grant
location permission when your browser prompts you. The live screen
(`/cardio/live`) is map-first with large stats and pause/resume/end
controls, designed for mobile use while actually moving outdoors. Location
is only watched while that screen is open — closing it, pausing, or ending
the activity stops the GPS watch.

## Design notes for the thesis writeup

- **History is append-only.** Body measurements, goals, cardio activities,
  and progress snapshots are never overwritten in place — every meaningful
  change is a new row, so historical charts stay accurate even as "current"
  values change.
- **Calories consumed vs. burned are always kept separate**, and burned
  calories are tagged by `source` (`MANUAL`, `GPS`, or `WEARABLE`) so the UI
  never conflates exercise calories with total daily energy expenditure.
- **Distance/pace/speed are computed server-side** from raw GPS points
  (Haversine distance between consecutive points) rather than trusted from
  the client, so a user can't spoof their stats by editing request payloads.
- **Ownership is enforced on every user-scoped route** — the API checks
  `record.userId === req.user.id` before returning or mutating anything, so
  changing an ID in the URL can't expose another user's data.
- **Wearable integration is provider-abstracted** (`WearableProvider`
  interface with a `MockWearableProvider` implementation) specifically so a
  real OAuth-based provider can be swapped in later without touching the
  routes, schema, or frontend — see `apps/api/src/modules/wearables/wearable.provider.ts`.

## What's stubbed / left as a clear extension point

This is a complete, runnable scaffold covering every module in the spec,
but a few things are intentionally minimal rather than "production SaaS"
depth, and are worth calling out explicitly in a thesis defense:

- Wearable sync uses a deterministic mock provider, not a real device API.
- There's no background job scheduler; `ProgressSnapshot` rows are upserted
  lazily whenever `/progress/history` is called rather than by a nightly cron.
- No email verification / password reset flow.
- No automated test suite yet (routes are structured to make one
  straightforward to add with supertest + a test database).
