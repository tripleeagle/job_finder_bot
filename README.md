# job_finder

Generic job alerts service. Users sign up on a small web form, pick their criteria, and receive matching CZ job postings by email (instant, daily, or weekly).

Generalisation of [job_bot](../job_bot): no hardcoded keywords, no hardcoded chat id, multi-user.

## Architecture

```
 ┌─────────────────┐         ┌────────────────────┐
 │  Signup site    │  HTTP   │  /api/subscribe    │──┐
 │  public/*.html  │ ─────▶  │  /api/verify       │  │
 └─────────────────┘         └────────────────────┘  │
                                                     ▼
                                              ┌─────────────┐
                                              │  Supabase   │
                                              │  Postgres   │
                                              └─────────────┘
                                                     ▲
 ┌────────────────┐  every 30 min   ┌──────────────────────────┐
 │ GitHub Actions │ ──────────────▶ │  npm run scrape          │
 │   cron         │                  │  fetch sources → filter  │
 └────────────────┘                  │  per user → email via    │
                                     │  Resend                  │
                                     └──────────────────────────┘
```

- **Web** (`public/` + `api/`) — static HTML signup form, two serverless endpoints on Vercel. No framework.
- **Scraper** (`src/scraper`) — Node script run by GitHub Actions every 30 min. Fetches once, then evaluates per user.
- **Sources** (`src/shared/sources`) — copied verbatim from `job_bot`. Add new ones by exporting a `Source`.
- **DB** — Supabase Postgres. Tables in `db/schema.sql`.
- **Email** — Resend.

## Setup

### 1. Supabase
1. Create a project at https://supabase.com (free tier).
2. SQL editor → paste `db/schema.sql` → run.
3. Settings → API → copy `URL` and `service_role` key.

### 2. Resend
1. Create an account at https://resend.com (free tier: 3k emails/month).
2. Add and verify a domain (or use the onboarding sandbox for testing).
3. Copy the API key.

### 3. Local dev
```bash
cp .env.example .env
# fill in the values
npm install

# dry run — prints what would be sent, writes nothing:
npm run scrape:dry

# real run:
npm run scrape
```

### 4. Deploy the signup site (Vercel)
```bash
npm i -g vercel
vercel link
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM
vercel env add SITE_URL   # the final Vercel URL
vercel --prod
```

### 5. GitHub Actions secrets
Repo → Settings → Secrets and variables → Actions → New repository secret. Add the same five keys as in `.env.example`. The workflow at `.github/workflows/scrape.yml` runs every 30 min.

## Adding a new source
Drop a `.ts` file in `src/shared/sources/`, export a `Source`, register it in `src/scraper/index.ts`. The `Job` interface in `src/shared/sources/types.ts` is what every source produces.

## Filter behaviour
- `keywords` — at least one must appear in title + description + location + employment type (substring, lowercased, NFKD-normalised).
- `locations` — at least one must appear, same matching. Empty means no location constraint.
- `excludeEmployment` — derived from the unchecked employment-type boxes (e.g. unchecking "Internship" excludes jobs whose text contains "internship" or "stáž").
- `excludeSeniority` — applied to title only. If "Senior" is checked, no seniority filter is applied.

See `src/shared/filter.ts`.

## What's not built yet
- Rate limiting on `/api/subscribe`.
- A way for a signed-up user to edit their criteria. Currently they'd have to subscribe again with the same email (upsert overwrites). Note: re-subscribing preserves their `unsubscribe_token` so links in previously-sent emails keep working.
