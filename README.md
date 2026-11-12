# StudioSpace API

Express + MongoDB API for **StudioSpace**, a peer-to-peer marketplace where creators discover and book photography studios, sound stages, podcast rooms, music suites and workshops.

The Next.js client lives in [B14-A8-Client](https://github.com/asadProfile/B14-A8-Client).

## What this API does

- Credential and Google sign-in with JWTs stored **only** in HTTPOnly cookies.
- Full studio CRUD with server-side validation and owner-only mutations.
- Discovery endpoints with category, keyword, price, rating and newest filters.
- Booking requests with server-calculated pricing and **confirmed-slot overlap prevention**.
- Reviews with live rating aggregation, a saved-studios wishlist and image uploads (ImgBB or local storage).
- A demo dataset that seeds itself on first boot so the app is never empty.

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20+ (ES modules) |
| Framework | Express 4 |
| Database | MongoDB + Mongoose 8 |
| Auth | JSON Web Tokens, bcrypt, HTTPOnly cookies, Google OAuth 2.0 |
| Validation | Zod |
| Uploads | Multer + ImgBB (local disk fallback) |
| Tests | Node's built-in test runner + Supertest + mongodb-memory-server |

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

That is all that is required locally. If `MONGODB_URI` is empty, the server starts
an in-memory MongoDB instance and seeds the demo dataset automatically. To use a
real database, set `MONGODB_URI` to a MongoDB Atlas connection string first.

```bash
npm run seed   # wipe and reseed the demo data
npm test       # 11 integration tests against an in-memory database
npm start      # production start (requires MONGODB_URI and JWT_SECRET)
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Examiner / host + guest | `examiner@studiosspace.com` | `Studio123` |
| Host | `host@studiosspace.com` | `Studio123` |

The examiner owns three listings, has incoming requests on the dashboard, and has
bookings in every status (Pending, Confirmed, Completed, Cancelled).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB Atlas connection string. Optional in development. |
| `ALLOW_IN_MEMORY_DB` | `true` lets a single-instance production host run the in-memory database when `MONGODB_URI` is blank. Data resets on restart — demo only, never on serverless. |
| `JWT_SECRET` | Token signing secret. **Required in production.** |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CLIENT_URL` | Allowed client origin(s), comma-separated |
| `PUBLIC_API_URL` | Public API origin used for upload URLs (optional) |
| `AUTO_SEED` | Seed demo data when the database is empty (default `true`) |
| `IMGBB_API_KEY` | Enables ImgBB uploads. Without it, images are stored in `uploads/`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enables Google sign-in |

Google OAuth redirect URI: `https://your-api-domain.com/api/auth/google/callback`.

## API reference

### Auth

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | — | Create an account (password rules enforced) |
| POST | `/api/auth/login` | — | Sign in; sets the HTTPOnly cookie |
| POST | `/api/auth/logout` | — | Clear the cookie |
| GET | `/api/auth/me` | optional | Current user or `null` |
| GET | `/api/auth/session` | required | 401 when signed out, user when signed in |
| GET | `/api/auth/google` | — | Start Google OAuth |
| GET | `/api/auth/google/callback` | — | OAuth callback; sets the cookie and redirects |

### Studios

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/studios` | — | Filters: `category`, `q`, `minPrice`, `maxPrice`, `sort`, `page`, `limit` |
| GET | `/api/studios/featured` | — | Six top-rated studios for the home page |
| GET | `/api/studios/mine` | required | Listings owned by the signed-in host |
| GET | `/api/studios/:id` | — | One studio plus related spaces |
| POST | `/api/studios` | required | Create a listing (owner taken from the JWT) |
| PATCH | `/api/studios/:id` | required | Owner-only update |
| DELETE | `/api/studios/:id` | required | Owner-only delete with cascade cleanup |

### Bookings

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/bookings` | required | Request a slot; rejects confirmed overlaps with `409` |
| GET | `/api/bookings/mine` | required | Bookings made by the signed-in user |
| GET | `/api/bookings/host` | required | Incoming requests for spaces the user hosts |
| GET | `/api/bookings/:id` | required | Guest or host only |
| PATCH | `/api/bookings/:id/cancel` | required | Guest cancels a pending request |
| PATCH | `/api/bookings/:id/confirm` | required | Host confirms; re-checks overlap first |
| PATCH | `/api/bookings/:id/complete` | required | Host marks a confirmed booking complete |

### Reviews, wishlist and uploads

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/studios/:studioId/reviews` | optional | Reviews, rating summary and the viewer's review |
| POST | `/api/studios/:studioId/reviews` | required | Create or update one review per user |
| DELETE | `/api/studios/:studioId/reviews/:reviewId` | required | Remove your own review |
| GET | `/api/wishlist` | required | Saved studios with full studio documents |
| POST | `/api/wishlist/:studioId` | required | Toggle save / remove |
| DELETE | `/api/wishlist/:studioId` | required | Remove from wishlist |
| POST | `/api/upload` | required | Multipart `image` field, max 5 MB |

## Security notes

- The JWT is never returned in JSON. It travels in an `HttpOnly`, `SameSite=Lax`,
  `Secure` (production) cookie, so client JavaScript cannot read it.
- Server-side mutation routes return `401 Unauthorized` when the cookie is absent
  or invalid, and `403 Forbidden` for ownership violations.
- Prices, fees, hours and totals are computed on the server; client-sent totals are ignored.
- Login and registration are rate-limited, passwords are hashed with bcrypt (12 rounds)
  and every request body is validated with Zod.
- Uploads accept raster images only (JPG, PNG, WebP, GIF) and cap size at 5 MB.

## Challenge coverage

1. **JWT security with HTTPOnly cookies** — `src/middleware/auth.js`, `src/utils/token.js`
2. **Double-booking prevention** — `src/routes/bookings.js` checks confirmed overlap on
   creation (`POST`) and again when a host confirms (`PATCH /confirm`). To try it, sign in
   as the examiner, open the confirmed booking in *My Bookings*, and request the same studio
   on the same date/time — the API responds with `409` and a clear message.
3. **Theme customization** — implemented in the Next.js client with a persisted
   light/dark theme and an inline script that prevents a flash on reload.

## Deployment

The API runs either as a Vercel serverless function or as a long-running
Render web service. Both need a MongoDB Atlas connection string
(`MONGODB_URI`) — the in-memory fallback is development-only by design.

### Vercel (serverless)

`api/index.js` exports the Express app as a Vercel function and `vercel.json`
rewrites every path to it, so `/api/*` and `/uploads/*` behave exactly as they
do locally.

1. Import the repository as a Vercel project and set the framework preset to
   **Other** (the Express preset expects its own entry point).
2. Set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`,
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the project's environment
   variables. `NODE_ENV=production` is provided by Vercel.
3. Keep `AUTO_SEED=true` for the demo dataset. The first request seeds the
   database, and later cold starts reuse it.
4. Point the client's `API_PROXY_URL` at the deployment. The Next.js rewrite
   keeps cookies first-party and forwards the browser origin, so Google
   sign-in uses the client domain's callback.
5. Optional: connect a Vercel Blob store to the project to enable image
   uploads. The connection injects `BLOB_READ_WRITE_TOKEN`, which the upload
   route picks up automatically (serverless filesystems are read-only).

### Render (long-running server)

The repository includes [`render.yaml`](render.yaml), so Render can create the
service from a Blueprint:

1. Push this repository, then in Render choose **New → Blueprint** and select it.
2. Render reads the build (`npm ci`) and start (`npm start`) commands, the
   `/api/health` health check, and prompts for the `sync: false` variables.
3. Recommended: create a MongoDB Atlas cluster and set `MONGODB_URI`. The
   Blueprint sets `ALLOW_IN_MEMORY_DB=true`, so a blank URI still runs an
   in-memory MongoDB that reseeds on every restart — fine for a demo, but the
   data does not survive deploys or the free tier's idle spin-down. Use Atlas
   for anything that must persist.
4. Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` when prompted (and
   `IMGBB_API_KEY` if you have one). `JWT_SECRET` is generated automatically.
5. Copy the service URL (for example `https://studiosspace-api.onrender.com`)
   and set it as `API_PROXY_URL` on the Vercel client project.
6. The first boot seeds the demo data when the database is empty; run
   `npm run seed` locally against Atlas if you want to reset it.

`CLIENT_URL` is preset to the deployed client origin. Keep it in sync if the
client domain changes — comma-separated if there is more than one.

Google sign-in uses the origin the browser opened, forwarded by the Next.js
proxy, so `CLIENT_URL` must include every client origin. For the hosted app:

```env
CLIENT_URL=https://b14-a8-client-one.vercel.app
GOOGLE_CLIENT_ID=<web client id>
GOOGLE_CLIENT_SECRET=<web client secret>
```

Register `https://b14-a8-client-one.vercel.app/api/auth/google/callback` (and
`http://localhost:3000/api/auth/google/callback` for local use) as authorised
redirect URIs on that OAuth client.
