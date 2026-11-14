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

- **Google-only sign-in** — public login uses Google OAuth; there is no public email/password signup, password reset, or email invitation flow.
- **Structured catalog** — AI and Cybersecurity majors, four academic years, two semesters each, subjects, chapters, sections, and materials.
- **In-browser previews** — PDF, images, video, audio, text/code, interactive HTML (isolated sandbox), Office documents, Google Drive, YouTube, and archives.
- **Personal library** — upload private files, organize saved items into lists, and download or share.
- **Public sharing** — revocable view/download links for single files or whole lists.
- **Publishing workflow** — students submit personal files for review; staff approve and publish into the official catalog.
- **Material ratings** — signed-in users can like or dislike official lecture items, section items, and resources; one vote per user and clicking the same reaction removes it. Public pages show aggregate counts only, while staff see voter identities and can review low-rated materials from the dashboard.
- **Staff tracks** — admins are grouped by major and academic year, with each member's term shown inside the group. The dashboard highlights the current admin's own group; super admins can edit any track while regular admins can edit their own.
- **Staff dashboard** — subjects, resources, tracks, material ratings, team roles, publish requests, and storage administration. Members must sign in with Google before an admin can assign their role.
- **Team messages with real email** — staff can message one member, a group, or everyone. Every message is stored as an in-app notification and mirrored by email; an email failure never drops the internal message, and failed deliveries can be retried from the broadcast panel.
- **Arabic RTL UI** — responsive layout, dark theme, accessible keyboard navigation.
- **Storage split** — Supabase for auth/DB/legacy media/avatars; Hugging Face private bucket (through a Cloudflare Worker and same-origin Pages Function) for personal study files, with per-user quotas and reservation-based accounting.
- **Privacy-friendly analytics** — Cloudflare Web Analytics for visitors plus an in-app admin summary for registered users and daily activity.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 7, React Router 7, Tailwind CSS 3, Radix UI, Framer Motion, Recharts |
| Auth / Database | Supabase Auth + Postgres with Row Level Security |
| File storage | Supabase Storage (legacy media/avatars), Hugging Face private bucket via Cloudflare Worker + Pages Function |
| Edge API | Cloudflare Workers (`workers/hf-upload`) with `aws4fetch` |
| Email | Supabase Auth Email provider disabled; staff-message email through the Gmail API (Brevo/Resend fallbacks) via a Pages Function |
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
  functions/invite-user legacy email function (not called by the public flow)
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
  - `VITE_TURNSTILE_SITE_KEY` (used by the legacy break-glass login)
  - `VITE_HF_UPLOAD_WORKER_URL`
  - `VITE_ENABLE_LEGACY_LOGIN` (default `false`; production is disabled and `/legacy-login` redirects to `/login`)
- `workers/hf-upload/.dev.vars.example`
  - `HF_ACCESS_KEY_ID`
  - `HF_SECRET_ACCESS_KEY`
  - `HF_NAMESPACE`
  - `HF_BUCKET`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Worker secret only)
  - `ALLOWED_ORIGINS`
  - `EMAIL_PROVIDER` (`gmail`, `brevo`, or `resend`), `EMAIL_FROM`, `SITE_URL`
  - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` when using Gmail
- root `.env.example` (local scripts only)
  - Supabase management/seed variables, Hugging Face export variables, Cloudflare deploy variables.
  - `TURNSTILE_SECRET_KEY` for Supabase Auth captcha configuration.
  - `BACKUP_ARCHIVE_PASSWORD`, `ONEDRIVE_BACKUP_DIR`, `PG_DUMP_BIN`, `SEVEN_ZIP_BIN` for encrypted backups.

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

### Email delivery

Team messages are written to `messages` first, then a Pages Function (`/api/send-message-email`) mirrors them by email and records state in `message_email_deliveries` (service-role writes; staff-only reads). The default provider is the **Gmail API** because a free Gmail account can send about 500 recipients/day without owning a domain, and mail lands in the inbox rather than spam.

1. In Google Cloud, enable the Gmail API and configure the OAuth consent screen.
2. Add `https://www.googleapis.com/auth/gmail.send` to Data Access.
3. Create an OAuth client of type **Desktop app**.
4. Authorize with `redirect_uri=http://localhost` and `access_type=offline`, then exchange the code at `https://oauth2.googleapis.com/token` for a refresh token.
5. Set `EMAIL_PROVIDER=gmail`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, and `EMAIL_FROM=Dev Academy <your-account@gmail.com>` as Pages runtime variables.

The endpoint refreshes the access token automatically, sends one RFC 822 `multipart/alternative` message per recipient (Arabic HTML plus plain text), retries rate limits, and marks each delivery `sent` or `failed`. `Brevo` and `Resend` remain selectable with `EMAIL_PROVIDER`; `MAX_BATCH` is 50 messages per call and the client pages through a broadcast.

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
- Build-time `VITE_*` values come from `app/.env` (gitignored) and are baked into the bundle.
- The Pages dashboard holds the runtime variables used by the Pages Function (`HF_*`, `SUPABASE_*`, `ALLOWED_ORIGINS`, and the email variables); it does not need the `VITE_*` values while deploys are manual.
- Production uses `VITE_ENABLE_LEGACY_LOGIN=false`; `/legacy-login` redirects to `/login`. The route remains `noindex, nofollow` and unlinked. Do not re-enable it unless the Email provider is also re-enabled deliberately.

### Deploying (manual, clean commit only)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

The script refuses to deploy when the working tree is dirty or the branch is not `master`, runs typecheck and build, and records the commit hash on the Pages deployment. The Pages project's production branch is `main`; the repository branch is `master`.

Security headers live in `app/public/_headers`. SPA fallbacks are limited to `/s/*` → `/app-shell` and `/dashboard/subjects/*` → `/dashboard-shell`; legacy `/admin/*` paths 301 to their `/dashboard/*` equivalents, and unknown paths return the static `404.html`.

## Security

- Public authentication is Google OAuth only. `/legacy-login` is disabled in production (`VITE_ENABLE_LEGACY_LOGIN=false`), redirects to `/login`, and remains unlinked/noindex as source-level fallback.
- Row Level Security is enabled on application tables; staff-only RPCs verify roles server-side.
- The browser never receives service-role or Hugging Face secrets.
- File uploads validate size, MIME type, and extension; object paths are user-scoped and canonicalized.
- Rate limits cover shares, publish requests, messages, and storage reservations.
- CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` are set at the edge.
- HTML previews run in an isolated `allow-scripts` iframe without same-origin access. Supabase serves public Storage HTML as `text/plain` by design, so HTML materials use the in-app preview rather than a direct Storage URL.

See [SECURITY.md](SECURITY.md) for reporting a vulnerability.

## Operations

### Encrypted off-site backup

`scripts/backup-offsite.mjs` dumps the `public`, `auth`, and `storage` schemas, copies all legacy Supabase `media` objects from a persistent cache, records the public Hugging Face dataset inventory, creates an encrypted 7z archive (`-mhe=on`), writes a SHA256 file, copies the archive to OneDrive, and prunes backups older than 14 days.

```powershell
# from the repository root, after filling root .env
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-backup-offsite.ps1
```

Media objects are cached once in `exports/backups/.media-cache/` (gitignored) with a size/etag manifest. Later runs reuse the cache and only download new or changed objects. Downloads are written to a `.part` file and renamed on success, so an interrupted run never leaves a truncated object behind; each download is retried three times and each object is checked against its Storage-reported size. `BACKUP_RESUME=0` forces a full re-download. The database dump is verified with `pg_restore --list` before the archive is created, and staging directories left by interrupted runs are pruned after two days.

The wrapper retries the whole backup once after five minutes. If the direct database host resolves IPv6-only (`db.<ref>.supabase.co`), set `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT=5432`, and `SUPABASE_DB_USER=postgres.<ref>` to the Supabase session pooler values shown in Dashboard → Connect.

The Windows task `DevAcademy Offsite Backup` runs the wrapper daily at 12:00, starts when the machine becomes available, and requires an active user session. It sets `BACKUP_INCLUDE_HF=0`; the 144-file public HF dataset is inventoried but not re-downloaded. Set `BACKUP_INCLUDE_HF=1` for a manual full-media copy. PITR is not available on the current plan; keep the daily archive and verify restores periodically.

The Windows task `DevAcademy Backup Check` runs `scripts/check-backup-freshness.ps1` daily at 20:00 and fails if the newest OneDrive archive is older than 36 hours. On failure it writes `C:\Users\islam\OneDrive\DevAcademyBackups\BACKUP-ALERT.txt`; the alert is removed automatically on the next successful check. Results are appended to `exports/backups/backup-check.log`.

### Legacy media policy (Supabase Storage stays as-is)

**Decision (2026-10-29):** legacy media stays in Supabase Storage and every existing database link stays unchanged. New uploads go to Hugging Face. No bulk rewrite and no object deletion are planned.

- **Old media:** 335 objects / about 849 MB in the Supabase `media` bucket, referenced by 494 links (315 `lecture_items.url`, 178 `section_items.url`, 1 `profiles.avatar_url`). The bucket is static apart from avatars, so the 1 GB free limit keeps roughly 175 MB of headroom.
- **New media:** subject/lecture files and personal files upload through the Hugging Face Worker. Avatars are the only new writes to Supabase Storage: compressed, one file per user (`avatars/<user-id>.<ext>`), with the previous file removed.
- **Backups:** because the legacy objects remain authoritative, the daily archive still includes about 890 MB of media (compressed archive about 734 MB).
- **Do not run** `node scripts/migrate-media-to-hf.mjs rewrite --apply`; there is no approved cutover.
- The abandoned partial upload (80 files, about 6 MB) was deleted from `legacy/` in `devacademy-fcai/devacademy-media` on 2026-10-29. The app never referenced it.

If storage pressure ever returns, the tooling is retained: `python scripts/upload-legacy-media.py` resumes the upload (batches of 20 files / 50 MiB, three retries, remote-size resume), then `node scripts/migrate-media-to-hf.mjs inventory`, `rewrite --apply --batch-size 25`, and `verify`. `rollback.sql` restores every changed link.

### Turnstile

Supabase Auth captcha is configured with the Turnstile widget `Dev Academy Auth`. The site key is public and belongs in `app/.env`; the secret belongs only in Supabase Auth settings and the root local `.env`. The public Google button does not use Turnstile, and the legacy email/password page is disabled in production.

### Google-only cutover

Production is strict Google-only (Pages deployment `a0c988f4`, commit `f7a472d`): `VITE_ENABLE_LEGACY_LOGIN=false`, Supabase `external.email=false` / `external.google=true`, and `/legacy-login` redirects to `/login`. A full Google OAuth login as a `super_admin` was verified after the cutover.

Five non-Google accounts remain retired in place. They have no Google identity yet, but Supabase automatically links a Google identity to an existing account when the email matches and is confirmed, so each person can sign in with the same Gmail address and keep their current role. The sixth account, `admin@devacademy.dev`, was deleted on 2026-10-28 after its 70 owned content rows (7 subjects, 9 chapters, 18 lectures, 6 sections, 6 section items, 18 lecture items, 6 resources) were transferred to `islam230366qw@gmail.com`; its single `task_reads` row cascaded away. The two active super admins are `islam230366qw@gmail.com` and `code39946@gmail.com`. No Supabase Edge Functions are deployed; see `db/functions/README.md`.

Disabling a staff profile now removes dashboard access in the UI as well as in RLS: `isStaff` and `isSuperAdmin` require `profiles.disabled = false`, and `is_staff()` already excludes disabled profiles. Re-enabling the Email provider would require a deliberate rollback of both Supabase Auth and the build flag.

## Roadmap

- Full SSR or static generation for catalog pages.
- Native password-protected share links.
- Richer analytics dashboard and alerting.
- Automated browser tests for upload/share/publish flows.

## Author

**Islam Abdo** — founder and maintainer.
GitHub: [@islam-abdo-1](https://github.com/islam-abdo-1)

## License

[MIT](LICENSE)
