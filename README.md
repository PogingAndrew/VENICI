# Venici — Fitness & Nutrition Tracking System

## Updates since initial scaffold

- **Renamed to Venici.** All user-facing "FitTrack" branding (sidebar,
  login/register, admin panel, browser tab title) is now "Venici." Internal
  package names (`fitness-tracker-api`, `fitness-tracker-web`) and seed
  email addresses (`demo@fittrack.dev`, `admin@fittrack.dev`) were left
  unchanged since renaming those requires a re-seed and isn't user-facing —
  say the word if you'd like those updated too.
- **Goal creation no longer asks for a starting value (bug fix + UX).**
  You already have a current weight on your profile — that's the starting
  point. `POST /api/goals` now fetches your latest logged weight
  server-side and uses it automatically; the "Create a goal" modal shows it
  as read-only context instead of asking you to re-type it. If you haven't
  logged a weight yet, goal creation is blocked with a clear message
  telling you to do that first.
- **Phantom weekly deficit fixed.** The Weekly Calorie Balance widget was
  treating any day with nothing logged as "ate zero calories that day,"
  which silently inflated the "so far this week" deficit purely from days
  you hadn't opened the app — not anything you actually did. Fixed:
  `computeDaySummary` now returns `hasLoggedData` (true if there's a meal,
  workout, cardio session, or wearable sync that day), and
  `computeWeekToDate` only counts maintenance calories, consumed, and
  burned for days where that's true. The card now shows "0 kcal · nothing
  logged yet this week" until you actually log something, instead of a
  large number that isn't real. See `trackedDaysElapsed` in
  `progress.service.ts` / `progress.routes.ts`.
- **Non-weight goals no longer corrupt calorie math.** Goals can be
  `WEIGHT_LOSS`/`WEIGHT_GAIN`/`WEIGHT_MAINTENANCE` or
  `FITNESS_IMPROVEMENT` (an arbitrary numeric target). The dashboard's
  "latest active goal" lookup now filters to `WEIGHT_GOAL_TYPES` only, so a
  Fitness Improvement goal's `targetValue` can never get treated as a
  target body weight.
- **Bulking/cutting-aware calorie math.** Target weight above current =
  **bulking** (needs a surplus); below = **cutting** (needs a deficit).
  `computeGoalCalorieAdjustment()` derives this plus a daily calorie
  adjustment, feeding both `/progress/today` (→
  `recommendedDailyCalories`, used by the Dashboard's calorie target and
  nutrition bar instead of raw maintenance) and `/progress/weekly-balance`
  (weekly tracking with a Bulking/Cutting/Maintaining badge).
- **Personal food library.** Any user can add their own custom foods via
  **Nutrition → My food library**, private to them and shown with a
  "Personal" badge when searched while logging a meal.
- **Richer onboarding.** Two-step registration: account details, then a
  fitness profile — date of birth (age derives from this so it never goes
  stale), sex, height, activity level, current weight, and goal weight —
  automatically creating the first body-weight measurement and an active
  goal.

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
