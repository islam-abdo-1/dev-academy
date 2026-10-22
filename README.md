# Dev Academy

[![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/pages/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Arabic-first study platform for computer science students** — curated lectures, summaries, past exams, and shareable study lists for Artificial Intelligence and Cybersecurity.

Dev Academy (ديف أكاديمي) brings scattered course material into one organized place: browse by major → year → semester → subject, preview files in the browser, save a personal library, and share lists with classmates.

> Live site: [dev-academy.pages.dev](https://dev-academy.pages.dev)
>
> Launch-readiness results: [REPORT.md](REPORT.md)

![Dev Academy home page](docs/screenshots/home-hero.png)

<p align="center">
  <img src="docs/screenshots/explore.png" alt="Explore majors" width="49%" />
  <img src="docs/screenshots/home-mobile.png" alt="Mobile home page" width="24%" />
</p>

## Features

- **Structured catalog** — AI and Cybersecurity majors, four academic years, two semesters each, subjects, chapters, sections, and materials.
- **In-browser previews** — PDF, images, video, audio, text/code, interactive HTML (isolated sandbox), Office documents, Google Drive, YouTube, and archives.
- **Personal library** — upload private files, organize saved items into lists, and download or share.
- **Public sharing** — revocable view/download links for single files or whole lists.
- **Publishing workflow** — students submit personal files for review; staff approve and publish into the official catalog.
- **Staff dashboard** — subjects, resources, team roles, publish requests, and storage administration.
- **Arabic RTL UI** — responsive layout, dark theme, accessible keyboard navigation.
- **Storage split** — Supabase for auth/DB/avatars; Hugging Face Public Bucket (through a Cloudflare Worker) for study files, with per-user quotas and reservation-based accounting.
- **Privacy-friendly analytics** — Cloudflare Web Analytics for visitors plus an in-app admin summary for registered users and daily activity.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 7, React Router 7, Tailwind CSS 3, Radix UI, Framer Motion, Recharts |
| Auth / Database | Supabase Auth + Postgres with Row Level Security |
| File storage | Supabase Storage (avatars/legacy), Hugging Face Public Bucket via Cloudflare Worker |
| Edge API | Cloudflare Workers (`workers/hf-upload`) with `aws4fetch` |
| Email | Supabase Edge Function (`db/functions/invite-user`) |
| Hosting | Cloudflare Pages |
| Analytics | Cloudflare Web Analytics |

## Project Structure

```
app/                    React/Vite frontend
  public/               static assets, _headers, _redirects, robots.txt
  scripts/prerender.mjs per-route HTML metadata + sitemap + 404 shell
  src/
    components/         UI, browse, material, share, dashboard
    hooks/              auth, storage, sharing, saved lists
    lib/                Supabase client, storage Worker client, SEO routes
    pages/              public and dashboard routes
db/
  migrations/           ordered SQL migrations (schema, RLS, RPCs)
  functions/invite-user Supabase Edge Function
workers/hf-upload/      signed Hugging Face upload/delete Worker
scripts/                seed, migration apply, export helpers
brand/                  logo source
```

## Getting Started

Requirements: Node.js 20+ and npm 10+.

```bash
git clone <your-repo-url>
cd dev-academy
npm --prefix app install
cp app/.env.example app/.env
npm --prefix app run dev
```

Open `http://localhost:5173`.

### Environment variables

Copy examples only; never commit real values.

- `app/.env.example`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_TURNSTILE_SITE_KEY` (optional)
  - `VITE_HF_UPLOAD_WORKER_URL`
- `workers/hf-upload/.dev.vars.example`
  - `HF_ACCESS_KEY_ID`
  - `HF_SECRET_ACCESS_KEY`
  - `HF_NAMESPACE`
  - `HF_BUCKET`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Worker secret only)
  - `ALLOWED_ORIGINS`
- root `.env.example` (local scripts only)
  - Supabase management/seed variables, Hugging Face export variables, Cloudflare deploy variables.

`VITE_*` values are public in the browser bundle. Never put a service-role key, Hugging Face secret, or provider API secret in a `VITE_*` variable.

### Database migrations

```bash
# from the repository root, after filling root .env
node scripts/db-apply.mjs --list
node scripts/db-apply.mjs
```

Apply migrations in order. Do not use `supabase db push` against the hosted project unless you have reviewed the pending set.

### Upload Worker

```bash
cd workers/hf-upload
npm install
npx wrangler secret put HF_ACCESS_KEY_ID
npx wrangler secret put HF_SECRET_ACCESS_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# set HF_NAMESPACE, HF_BUCKET, SUPABASE_URL, ALLOWED_ORIGINS in wrangler.jsonc or dashboard
npm run deploy
```

Then set `VITE_HF_UPLOAD_WORKER_URL` in `app/.env` to the deployed Worker URL.

## Build & Deploy

```bash
cd app
npm run build
```

`npm run build` runs Vite, then `scripts/prerender.mjs` to generate per-route metadata, `404.html`, public/app/dashboard shells, and `sitemap.xml`.

Cloudflare Pages settings:

- Root directory: `app`
- Build command: `npm run build`
- Output directory: `dist`
- Add the `VITE_*` environment variables in the Pages dashboard.

Security headers live in `app/public/_headers`. SPA fallbacks are limited to `/s/*` → `/app-shell` and `/dashboard/subjects/*` → `/dashboard-shell`; legacy `/admin/*` paths 301 to their `/dashboard/*` equivalents, and unknown paths return the static `404.html`.

## Security

- Row Level Security is enabled on application tables; staff-only RPCs verify roles server-side.
- The browser never receives service-role or Hugging Face secrets.
- File uploads validate size, MIME type, and extension; object paths are user-scoped and canonicalized.
- Rate limits cover shares, publish requests, messages, and storage reservations.
- CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are set at the edge.
- HTML previews run in an isolated `allow-scripts` iframe without same-origin access. Supabase serves public Storage HTML as `text/plain` by design, so HTML materials use the in-app preview rather than a direct Storage URL.

See [SECURITY.md](SECURITY.md) for reporting a vulnerability.

## Roadmap

- Full SSR or static generation for catalog pages.
- Native password-protected share links.
- Optional backup export to an independent object store.
- Richer analytics dashboard and alerting.
- Automated browser tests for upload/share/publish flows.

## Author

**Islam Abdo** — founder and maintainer.
GitHub: [@islam-abdo-1](https://github.com/islam-abdo-1)

## License

[MIT](LICENSE)
