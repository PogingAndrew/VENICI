# Venici — Fitness & Nutrition Tracking System

## Latest update: PWA support, for packaging as an installable APK

Added everything needed to make this an installable Progressive Web App,
which is the prerequisite for wrapping it into a real Android `.apk` via
PWABuilder (no native tooling required — see steps below):

- `apps/web/public/manifest.webmanifest` — app name, orange/black theme
  colors matching the brand, standalone display mode, icons.
- `apps/web/public/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png` — generated to match the
  existing brand mark (orange rounded square, "V", near-black background).
  Maskable icon keeps a safe-zone margin so Android's adaptive-icon shape
  mask doesn't clip it.
- `apps/web/public/sw.js` — a minimal service worker (network-first,
  falls back to cache when offline). Deliberately does **not** precache
  API calls or cross-origin requests — only same-origin static assets.
  Required for PWA installability; hand-written rather than using a
  precache-manifest plugin since Vite's hashed build filenames change
  every deploy.
- `index.html` — links the manifest/icons and adds the mobile
  web-app meta tags (`theme-color`, `apple-mobile-web-app-*`).
- `main.tsx` — registers the service worker on load, scoped to
  `BASE_URL` so it resolves correctly whether deployed at a domain root or
  a GitHub Pages subpath (verified by building with a test subpath and
  confirming the manifest/icon `href`s — deliberately relative, no leading
  slash — resolve correctly either way; they're resolved by the browser
  relative to `index.html`'s own served location, so no Vite-specific
  handling was needed).

### Turning this into an APK for phone testing

1. **Deploy first.** An APK needs a real HTTPS URL — it can't reach
   `localhost`. Follow the GitHub Pages (frontend) + Render/Railway
   (backend) steps earlier in this README if you haven't already.
   Geolocation (the cardio tracker) also requires HTTPS to work at all.
2. Go to **[pwabuilder.com](https://www.pwabuilder.com)** and paste your
   deployed URL.
3. It reads `manifest.webmanifest` automatically and scores your PWA
   readiness — the manifest and service worker here already cover the
   required checks.
4. Under **Android**, click **Generate Package** → downloads a signed
   `.apk`/`.aab` directly, no Android Studio needed.
5. Install on a test phone: transfer the file and open it (allow
   "install unknown apps" for that source), or `adb install app.apk` over
   USB.

**Smartwatches:** technically Wear OS is Android, so the same APK could be
sideloaded onto a Wear OS device — but this UI (sidebar, cards, charts) is
designed for a phone/desktop screen and would be unusable on a small watch
face without a dedicated Wear OS layout. Not recommended for testing
unless a dedicated watch UI is built separately.

---

## Latest update: "request accepted" notification + Messenger-style timestamps

- **Notified when your follow request is accepted.** The notification bell
  had pending requests *received* covered, but nothing told you when a
  request *you sent* got approved. New "Accepted" section in the dropdown:
  "X accepted your follow request," linking to their profile. No new
  schema — reuses `FollowRequest.updatedAt` (already bumped automatically
  by Prisma's `@updatedAt` when a request is approved) compared against
  the same `notificationsLastCheckedAt` baseline already used for new
  posts, so opening the bell clears both at once.
- **Messenger-style timestamp dividers in Messages.** A small centered
  timestamp now appears above a message whenever it's the first in the
  thread, or at least 10 minutes have passed since the previous message —
  a burst of back-to-back messages doesn't get stamped on every single
  one, matching how Messenger actually behaves. Formatting tiers the same
  way too: `2:34 PM` today, `Yesterday 2:34 PM`, `Mon 2:34 PM` within the
  last week, `Jan 5, 2:34 PM` further back. See
  `shouldShowMessageTimestamp()` / `formatMessageTimestamp()` in
  `lib/format.ts`.

No schema changes this time — just restart the API, no migration needed.

---

## Latest update: notification bell (follow requests, new posts, unread messages)

Follow requests had no visible home before this — they only showed up
inside a button buried in Edit Profile, easy to never discover. Added a
proper notification bell (top of the sidebar, next to the logo) that
aggregates three things into one dropdown:

- **Follow requests** — the original problem this was meant to solve.
  Shown with inline **Approve**/**Reject** buttons right in the dropdown,
  no need to navigate anywhere first.
- **New posts from people you follow** — since your last time opening the
  bell. Clicking one goes to the author's profile.
- **Unread messages** — conversations where the other person's most recent
  message is newer than the last time you opened that thread. Clicking
  jumps straight to the conversation.

A red badge on the bell shows the total count (capped at "9+"), and the
list polls every 30 seconds so it stays reasonably fresh without needing
real-time infrastructure this app doesn't have.

**How "seen" is tracked, since there's no separate notifications table:**
each category is computed live from data that already exists, so nothing
can go stale or duplicate, but there's also no permanent notification
history — a reasonable tradeoff for what this is.
- Follow requests: naturally clear when approved/rejected (the `PENDING`
  status *is* the unread state).
- Messages: `Conversation` gained `lastReadByA`/`lastReadByB` timestamps,
  set whenever that participant fetches the thread's messages (i.e.
  opening a conversation marks it read — same endpoint the Messages page
  already called).
- Posts: `Profile` gained `notificationsLastCheckedAt`; opening the bell
  calls `POST /api/notifications/mark-seen` to reset it. Defaults to
  "now" at signup so a new account doesn't see every historical post as
  unread the moment they follow someone.

**Schema changed** — `Conversation.lastReadByA/B`,
`Profile.notificationsLastCheckedAt`. Run:

```bash
cd apps/api
npx prisma migrate dev --name notifications
```

---

## Latest update: spec audit — edit posts, mobile-responsive Messages

Re-checked the app against the original social-features spec now that
several sessions of work have layered on top of it. Found and fixed two
real gaps:

- **Editing your own posts had no UI.** The backend (`PATCH /posts/:id`)
  supported it from the start, but nothing in the frontend ever called it
  — only Delete existed. `PostComposerModal` now doubles as an edit form
  (pass it `editingPost` and it pre-fills, titles itself "Edit post," and
  PATCHes instead of POSTs), and every `PostCard` for your own posts shows
  both **Edit** and **Delete**. Delete is also now self-sufficient — it
  hides itself locally the instant it succeeds, rather than depending on
  the parent page to have wired up an `onDelete` callback (Feed hadn't).
- **Messages wasn't mobile-friendly.** List and thread were both always
  visible side-by-side, which crams badly on a phone-width screen — a
  direct miss against the spec's explicit "mobile-friendly layouts"
  priority. Now: below the `md` breakpoint, only one panel shows at a
  time (list, or the open thread with a **←** back button); from `md` up,
  nothing changed — still side-by-side as before.

No schema or route changes — both fixes are frontend-only, reusing
endpoints that already existed.

---

## Latest update: merged social profile into the Fitness Profile page

Previously the social profile (bio, followers/following, posts) lived at a
separate `/u/:userId` route, disconnected from the private fitness-data
page at `/profile`. Merged them:

- **`/profile` now has a social header** — avatar, name, `@username`, bio,
  follower/following counts, **+ Create Post**, **Edit social profile**,
  and **Follow requests** — sitting above the existing fitness stats
  (age/BMI/height/weight) and edit form, with your **Posts** listed below
  using the same `PostCard` component the Feed uses (like/comment/share
  all work identically there).
- **`/u/:userId` redirects to `/profile` when it's your own id** — so
  there's one canonical place for your own profile instead of two pages
  showing overlapping info. Visiting someone *else's* `/u/:userId` is
  unchanged (Follow/Message buttons, privacy gating, etc. all still work
  exactly as before). Sidebar links now point straight at `/profile`.
- No schema or API changes — this was purely a frontend composition
  change, reusing the same `GET /profile`, `GET /profile/user/:id`, and
  `GET /posts/user/:id` endpoints that already existed.

---

## Latest update: real social interactions (like/comment/share), open feed, and a full re-theme

- **Likes, comments, and share-to-message.** Posts now behave like a real
  social feed instead of static text:
  - **Like** — `POST /api/posts/:id/like` toggles a `Like` row (unique per
    post/user, so double-clicking just toggles state), with an optimistic
    UI update that reconciles against the server response.
  - **Comment** — `GET/POST /api/posts/:id/comments`, rendered in a
    dedicated comments modal with clickable commenter names.
  - **Share** — deliberately scoped to exactly what you asked for: sharing
    sends the post to a chosen user **as a message**, not a generic
    repost. `POST /api/posts/:id/share` creates a `Message` with a
    `sharedPostId` reference; the recipient sees a clickable mini post-card
    in the conversation thread, not just a text blob. Enforces both the
    post's privacy (can you even see it) and the recipient's messaging
    privacy setting.
  - New `Like` and `Comment` Prisma models; `Message` gained an optional
    `sharedPostId`.
- **Open feed — public posts show up even if you don't follow the author.**
  Previously the feed was strictly "people you follow." Now: posts from
  anyone with a **public** account appear regardless of follow status
  (private accounts you don't follow still never appear — that boundary is
  unchanged). Every post in the feed carries an inline **Follow** button
  next to the author's name so you can follow directly from the feed
  without a page navigation, plus like/comment/share counts, a relative
  timestamp ("2h ago"), and the author's `@username` — all wired through
  one shared `PostCard` component used by both Feed and profile pages, so
  they can't drift out of sync.
- **Clickable usernames in Messages.** Both the conversation list and the
  active thread header link to the other person's profile now (previously
  only the thread header did, and even that required reading the code to
  notice — the list rows were plain buttons with no way to jump to a
  profile). Avatar and name each stop click-propagation so clicking them
  opens the profile instead of the conversation underneath.
- **Full re-theme: professional black + orange.** The `brand` color token
  (used almost everywhere — buttons, links, badges, progress bars, active
  nav states) is now an orange scale instead of green, and the sidebar is
  a dark near-black instead of white, matching the Admin Panel's existing
  dark styling for a consistent, unified look. Chart colors (Recharts uses
  literal hex, not Tailwind classes, so the token swap doesn't reach them
  automatically) and the Leaflet route-map colors were updated by hand to
  match. This is a systemic re-theme via one config file plus a handful of
  hardcoded chart-color spots — not a per-component redesign, so some
  visual polish is still improvable if you want to iterate further.

**Schema changed again** — `Like`, `Comment` models, `Message.sharedPostId`.
Run:

```bash
cd apps/api
npx prisma migrate dev --name likes-comments-share
```

---

## Latest update: user search, discoverable Create Post, messaging privacy

The social system had two real gaps: no way to find other users, and no
obvious way to actually create a post outside your own profile page. Both
fixed, fully backend-connected (not mock UI):

- **User search** — new **Search** page (prominent in the sidebar nav, not
  buried in Settings), `GET /api/users/search?q=...`. Matches by name or a
  new `@username` handle, case-insensitive partial match, capped at 20
  results, debounced client-side. Every account now gets a unique,
  auto-generated username at registration (editable later from Edit
  Profile) — `generateUniqueUsername()` in `utils/username.ts`. Each result
  shows avatar, name, @username, bio, and the correct
  Follow/Following/Requested + Message button state, computed server-side
  per result (no separate round-trip per row).
- **Create Post, made actually discoverable** — a prominent **✏️ Create
  Post** button now sits at the top of the sidebar (works from anywhere,
  opens a global composer), plus an entry point at the top of the Feed
  ("What's on your mind?"), plus the existing button on your own profile
  (now labeled **+ Create Post** and, when you have zero posts, shown as a
  dedicated "You haven't posted anything yet → Create your first post"
  empty state instead of a generic one). All three share one
  `PostComposerModal` component hitting the same `POST /api/posts` — no
  duplicated logic, no mock state.
- **"Who can message you?" privacy setting** — new `Profile.messagingPrivacy`
  (`Everyone` / `People I follow` / `Mutual followers only` / `No one`),
  editable from Edit Profile. Enforced **server-side** in
  `messages.routes.ts` via `canMessageUser()` — this only gates *starting a
  new* conversation; an existing thread stays usable even if the privacy
  setting changes afterward, so people aren't retroactively locked out
  mid-conversation. The Message button (on profiles and in search results)
  disables itself with an explanatory tooltip when the target's setting
  doesn't allow it, but a direct API call is blocked the same way
  regardless of what the frontend shows.
- Search results and the profile page's Message button both hit this same
  `canMessage` check, so the UI and the enforcement can't drift apart.

**Schema changed again** — `Profile.username` (nullable + unique, so this
migrates safely without a backfill) and `Profile.messagingPrivacy` (enum,
defaults to `EVERYONE` so nothing existing breaks). Run:

```bash
cd apps/api
npx prisma migrate dev --name user-search-and-messaging-privacy
```

---

## Latest update: social features, auto-calorie workouts, and fixes

- **Social features.** Full follow/message/post system layered onto the
  existing app, reusing the same auth, Prisma, and page conventions:
  - **Social profile** at `/u/:userId` (your own is linked from the
    sidebar) — avatar (image URL or initials placeholder), name, bio,
    follower/following counts, posts, Follow/Unfollow or Message button.
    Your own profile gets an **Edit profile** button (bio, avatar, privacy)
    and a **Follow requests** inbox.
  - **Private accounts.** Toggle in Edit Profile. Public accounts: anyone
    can see posts. Private: only approved followers can — enforced
    server-side in `posts.routes.ts` (`canViewPosts`) and `feed.routes.ts`
    (a feed only ever contains posts from users you already have an
    *approved* Follow relationship with), not just hidden in the UI.
    Following a private account creates a `FollowRequest` instead of an
    immediate `Follow`; the owner approves/rejects from their profile.
  - **Feed** at `/feed` — posts from people you follow, newest first,
    cursor-paginated (`?cursor=<ISO timestamp>`) and wired up to an
    IntersectionObserver for infinite scroll.
  - **Messaging** at `/messages` — one conversation per unique pair of
    users (deterministic regardless of who started it), a "Message"
    button on any profile gets-or-creates the conversation and jumps
    straight to it.
  - New Prisma models: `Post`, `Follow`, `FollowRequest`, `Conversation`,
    `Message`; `Profile` gained `bio`, `avatarUrl`, `isPrivate`.
  - Your private fitness data (weight, BMI, goals) is **not** exposed by
    the social profile endpoint (`GET /profile/user/:userId`) — only
    name/bio/avatar/privacy/counts/relationship. The existing `/profile`
    (self, fitness data) is untouched and still named "Fitness Profile" in
    the sidebar to keep the two concepts distinct.
  - No image upload pipeline exists in this app, so avatars are a pasted
    image URL with an initials-based placeholder fallback, not a file
    upload — flagged here in case that matters for your thesis scope.
- **Nutrition: custom gram amounts.** `Food` gained an optional
  `gramsPerServing`. Selecting a gram-based food while logging a meal now
  shows a gram-amount step with a live-scaled nutrition preview
  (`nutrient_for_amount = nutrient_per_serving × (grams / gramsPerServing)`)
  before you confirm — matches the 165kcal/100g → 115.5kcal/70g example
  exactly. Foods without a gram-based serving (e.g. "1 medium") keep the
  original whole-serving-count flow.
- **Workout calories: auto-calculated.** No more manually guessing calories
  burned per session. `estimateWorkoutCalories()` (in `utils/calories.ts`)
  derives it from session duration, total volume lifted (sets × reps ×
  weight), and the user's own weight/age/sex/height — MET is chosen
  dynamically from lifting intensity (volume per minute relative to
  bodyweight), then scaled by the ratio of the person's BMR to a generic
  1-MET baseline so age/sex/height actually matter, not just a flat
  lookup table. A manually entered value is still respected if provided.
- **Total weight lifted, in weekly reports.** `Workout.totalVolumeKg` is
  now cached at creation and summed into `totalWeightLiftedKg` in
  `POST /api/reports/generate`, shown on the Reports page. The Workouts
  form was also missing its weight-per-set input entirely (bug) — fixed,
  with a live "12 × 30kg = 360 kg lifted" readout as you fill in a set.
- **Food library bug fixed.** An admin adding a food through the personal
  "My food library" form was silently creating a *shared* library entry
  instead (an admin-detection default was backwards) — explains foods that
  were searchable in meal-logging but invisible under "My food library."
  Fixed: food creation is always personal to the caller now, regardless of
  role; only the dedicated Admin Panel form explicitly requests
  `shared: true`.
- **Goals: one active goal, with delete/edit, and a weight-sync prompt.**
  Creating a goal while one is already active is now blocked (409) instead
  of silently allowed — this is what caused the earlier "wrong goal used
  for calorie math" bug, so it's now prevented outright rather than just
  worked around. Added Delete and Edit (target value) to each goal card.
  Completing a weight-type goal now prompts "update your current weight to
  match?" (yes/no) instead of leaving your logged weight stale.

**This changed the database schema again** — `Food.gramsPerServing`,
`Workout.totalVolumeKg`, `Profile.bio/avatarUrl/isPrivate`, plus the five
new social/messaging models. Run:

```bash
cd apps/api
npx prisma migrate dev --name social-and-workout-calories
```

If that reports drift/conflicts on a throwaway dev database:
`npx prisma migrate reset` (drops and rebuilds, then reseeds).

---

## Earlier updates (for reference)

## Updates since initial scaffold

- **Leaderboards.** New page (sidebar → Leaderboards) ranking every user
  across four categories, Hevy/Strava-style:
  - **Heaviest Lifted** — total training volume (sets × reps × weight,
    summed across all logged `WorkoutExercise` entries). The Workouts page
    was missing the weight input entirely (data model already supported it,
    the form just didn't expose it) — fixed, with a live "Volume: 3 × 10 ×
    50kg = 1,500 kg lifted" readout as you fill in a set.
  - **Cardio Distance** — total km from completed cardio activities.
  - **Fastest Pace** — best (lowest) average pace from RUNNING activities
    only (pace isn't comparable across activity types).
  - **Goals Completed** — count of completed weight-type goals.

  Volume/distance/pace support an All time / This month / This week filter;
  goals is all-time only. Each list highlights your own row, and shows your
  rank separately if you're outside the top 20. The Dashboard also gets a
  compact **Your Rankings** card summarizing all four. See
  `apps/api/src/modules/leaderboard/` and `GET /api/leaderboard`,
  `GET /api/leaderboard/summary`.
- **GitHub Pages deployment support.** GitHub Pages only serves static
  files, so the frontend can go there but the API + Postgres need separate
  hosting. Added: `VITE_API_URL` (apiClient now targets a configurable
  backend instead of hardcoded `/api`), `VITE_BASE_PATH` (GitHub Pages
  project sites serve from `/repo-name/`, not `/`), a `404.html` postbuild
  copy (GitHub Pages has no server-side rewrite, so deep links like
  `/dashboard` need this SPA fallback), and a ready-to-use
  `.github/workflows/deploy-pages.yml`. On the API side, `CLIENT_ORIGIN`
  now accepts a comma-separated list and `COOKIE_SAME_SITE` is configurable
  (`none` is required for the auth cookie to work when frontend and API are
  on different domains). Full deploy steps below.
- **Non-weight goals no longer corrupt calorie math.** Weight/calorie
  calculations only ever consider `WEIGHT_LOSS`/`WEIGHT_GAIN`/
  `WEIGHT_MAINTENANCE` goals, never `FITNESS_IMPROVEMENT`.
- **Phantom weekly deficit fixed.** Days with nothing logged no longer
  count as "ate zero calories" toward the Weekly Calorie Balance — only
  days with real logged activity contribute.
- **Goal creation simplified.** No more "starting value" field — your
  current logged weight is used automatically.
- **Bulking/cutting-aware calorie math**, **personal food library**, and
  **richer onboarding** (date of birth, height, activity level, weight
  goals at signup) — see earlier entries below if you're reading this
  top-to-bottom for the first time... this file has gotten long, happy to
  trim it if you'd rather just read the code.

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

## Deploying: frontend on GitHub Pages, API elsewhere

### 1. Deploy the API + database first

Pick a host with an always-on free/cheap tier — [Render](https://render.com)
or [Railway](https://railway.app) both work well for a small Node API, paired
with a hosted Postgres like [Neon](https://neon.tech) or
[Supabase](https://supabase.com) (or Render/Railway's own Postgres add-on).

- Root directory: `apps/api`
- Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
- Start command: `npm run build && npm start` (or `npm run dev` on a host
  that doesn't need a separate build step)
- Environment variables: everything in `apps/api/.env.example`, plus:
  - `DATABASE_URL` → your hosted Postgres connection string
  - `CLIENT_ORIGIN` → `https://your-username.github.io` (no trailing slash)
  - `COOKIE_SAME_SITE` → `none`
  - `NODE_ENV` → `production`
- Run `npm run prisma:seed` once (via the host's shell/console) if you want
  the sample foods/exercises/demo accounts.

Note the deployed API's URL, e.g. `https://venici-api.onrender.com`.

### 2. Configure the frontend build

In your GitHub repo: **Settings → Secrets and variables → Actions → Variables**,
add:

- `VITE_API_URL` = `https://venici-api.onrender.com` (your API URL from step 1, no trailing slash)

`VITE_BASE_PATH` is set automatically by the workflow from your repo name —
no action needed unless this repo *is* your `username.github.io` root site,
in which case delete that line from the workflow (base path should be `/`).

### 3. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source → GitHub Actions.**

### 4. Push to `main`

The included `.github/workflows/deploy-pages.yml` builds `apps/web` and
deploys it automatically on every push to `main` that touches that folder.
Check the **Actions** tab for progress; once it succeeds, your site is live
at `https://your-username.github.io/repo-name/`.

### Notes

- If login doesn't persist (redirects back to `/login` after refresh),
  double-check `COOKIE_SAME_SITE=none` is set on the **API**, and that
  `CLIENT_ORIGIN` on the API exactly matches your GitHub Pages URL
  (including `https://`, no trailing slash).
- The workflow only triggers on changes under `apps/web/`. If you only
  change the API, redeploy it through your API host directly — GitHub Pages
  has nothing to do with the backend.
- Prefer not to split hosts? Render, Railway, and Fly.io can all serve the
  built frontend as static files *from the same service* as the API,
  avoiding the cross-domain cookie complexity entirely. GitHub Pages is
  free and simple but is frontend-only by design.

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
