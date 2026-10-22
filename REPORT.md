# Dev Academy — Launch Readiness Report

**Date:** 2026-10-22  
**Scope:** Security hardening, storage/quota correctness, accessibility, SEO, performance, local load, repository hygiene, and deployment readiness.  
**Constraint:** No production or third-party writes were performed. All runtime checks below are local unless explicitly marked otherwise.

> **Post-audit update (2026-10-22):** The production build has since been deployed and smoke-tested. The original audit constraint and NO-GO conclusions below describe the earlier snapshot; see **Final Verification Update** for the superseding production status.

## Executive Summary

- The two most serious application risks are fixed in source and the pending hardening migration: cross-user file exposure through saved-list JSON, and Worker object-path traversal. They become effective after deployment and migration application.
- Storage accounting now uses reservation/confirmation/release RPCs with server-side quota checks; client-side quota bypasses were revoked in the pending hardening migration.
- The application builds cleanly, typechecks, and scores **1.00 for accessibility and SEO** in Lighthouse.
- Static local load tests sustained ~**4.0k–4.9k requests/second** with zero errors; no breaking point was found at 300 concurrent connections.
- Production is **not yet approved**. Migrations `0026`–`0028` are unapplied, Worker/Supabase end-to-end flows are unverified, and live Cloudflare headers/redirects have not been checked.
- Staging is conditionally ready once the database is backed up, migrations are applied, and Worker/Pages environment variables are configured.

## Verification Matrix

| Check | Result | Notes |
| --- | --- | --- |
| App TypeScript | PASS | `npm run typecheck` |
| Worker TypeScript | PASS | `npx tsc --noEmit` |
| Production build | PASS | 30 public routes, 10 app shells, 404, sitemap |
| Wrangler Pages routing | PASS (local) | Share, dashboard, admin redirects, 404 |
| Lighthouse accessibility | PASS | 1.00 |
| Lighthouse SEO | PASS | 1.00 |
| Lighthouse performance | ATTENTION | 0.92–0.93; LCP 2.9s locally |
| Lighthouse best practices | ATTENTION | 0.96 with local analytics; 1.00 when beacon blocked |
| Autocannon static load | PASS | 0 errors/timeouts at 20/100/300 connections |
| `npm audit` | ATTENTION | 5 high, 2 moderate, 0 critical; Tailwind dev chain; production-only audit is 0 |
| Secret history scan | PASS | gitleaks `NO_MATCHES` |
| Remote migrations | NOT RUN | Blocked pending credentials/snapshot |
| Authenticated E2E | NOT RUN | Blocked pending test users and deployed Worker |
| Production headers/routing | NOT RUN | Local Pages emulation only |

## Security and Correctness

### Resolved in source

- **Cross-user saved-list file leak** — `_saved_list_items_json` now joins the list owner and only returns files owned by that user or explicitly public files.
- **Worker path traversal** — object paths must contain exactly two segments, start with the authenticated owner prefix, use a safe filename, and reject `..`, backslashes, NUL, and leading dots.
- **Quota bypass through service RPCs** — service storage functions are no longer executable by clients; the Worker calls them with the service role.
- **Direct share-token creation** — direct `INSERT/UPDATE` on `share_tokens` was revoked; the app uses `create_share_link`.
- **Public share identity leak** — migration `0027` removes email fallback behavior and pending-view exposure.
- **Rate-limit table exposure** — `public.rate_limit_events` is revoked from `PUBLIC`, `anon`, and `authenticated`.
- **Message identity tampering** — `protect_message_update` freezes sender/recipient identity fields for non-staff while allowing the read flag.
- **Shared URLs and previews** — user-controlled URLs are sanitized in share, saved-list, Drive, media, and material views.
- **HTML preview isolation** — HTML content is rendered in a sandboxed iframe with scripts disabled.
- **No dangerous HTML sinks** — no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`, or app-level `postMessage` in application source.
- **External links** — all 19 `target="_blank"` anchors include `rel="noopener noreferrer"`.
- **Arabic text corruption** — repaired genuine double-encoded content in 7 files/184 lines and corrected punctuation; repository scan is clean. PowerShell 5.1 `Get-Content` can display valid Arabic as mojibake, so UTF-8 file reads must use Node or the editor read tool.

### Migration `0028_launch_hardening.sql`

Prepared but **not applied**:

- Share, publish-request, and message rate limits.
- Storage reservation/confirmation/release with quota and status checks.
- `service_reserve_storage` rejection for missing/disabled profiles.
- `service_remove_storage_object` for post-provider-delete accounting.
- Staff-only analytics RPC (`get_admin_analytics`).
- `new_users_7d` corrected to a rolling seven-day window.
- Share/publish/message protection triggers.
- URL CHECK constraints for application-provided links.
- Revocation of legacy client quota RPCs.
- Revocation of direct rate-limit table access.

No SQL runtime test was possible in this environment. The migration was reviewed manually and must be applied to staging first.

## Performance

### Changes

- Route-level lazy loading for every page except Home.
- Lazy-loaded archive, material viewer, share, save, and dialog surfaces.
- Removed the unused TypeScript share dialog and external QR dependency.
- Home hero `<h1>` renders immediately instead of waiting for a motion observer.
- Logo resized from 256px to 128px and converted to WebP:
  - `logo-mark.png`: **111,944 B → 30,415 B**
  - `logo-mark.webp`: **3,440 B**
- WebP cache header added.
- Prerendered public metadata for 30 routes.
- Static fallback shells for `/s/*` and `/dashboard/subjects/*`.

### Build output

| Asset | Raw | Gzip |
| --- | ---: | ---: |
| Main application chunk | 164.89 KB | 54.62 KB |
| CSS | 50.48 KB | 9.31 KB |
| Archive chunk (lazy) | 73.58 KB | 24.19 KB |
| React vendor chunk | 181.51 KB | 59.82 KB |
| Supabase vendor chunk | 224.17 KB | 58.77 KB |

The main application chunk is down from the original ~92.46 KB gzip; route and dialog chunks load on demand.

### Lighthouse

Default Lighthouse mobile emulation, local Vite preview:

| Category | Home | Explore |
| --- | ---: | ---: |
| Performance | 0.92–0.93 | — |
| Accessibility | 1.00 | 1.00 |
| Best Practices | 0.96 with analytics; 1.00 with `cloudflareinsights` blocked | 0.96 |
| SEO | 1.00 | 1.00 |

| Metric | Result |
| --- | ---: |
| LCP | 2.9 s |
| FCP | 2.3–2.4 s |
| CLS | 0.013–0.015 |
| TBT | 0–30 ms |
| Speed Index | 2.3–2.4 s |

Notes:

- LCP is still slightly above the 2.5s “good” threshold in local mobile emulation.
- The notification label mismatch was removed by converting the visible count badge to an unlabeled red dot while retaining the count in `aria-label`.
- The image-delivery audit no longer appears after WebP conversion.
- Local console errors are only the Cloudflare Analytics RUM CORS requests from `localhost`; this should disappear on the deployed origin but must be confirmed live.
- Lighthouse `llms.txt`/`ai-catalog` advisory audits are not launch blockers for this application.

## Load and Reliability

Local static preview, no authentication, database, or Worker in the path:

| Test | Requests | RPS | Avg latency | p95 | p99 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 20 connections, Home, 10s | 53,516 | 4,866 | 3.58 ms | 5 ms | 6 ms | 0 |
| 100 connections, subject page, 10s | 41,344 | 4,135 | 23.66 ms | 28 ms | 30 ms | 0 |
| 300 connections, subject page, 10s | 41,085 | 4,109 | 72.44 ms | 83 ms | 93 ms | 0 |
| 20 connections, `/ai`, 30s soak | 119,473 | 3,983 | 4.55 ms | 6 ms | 7 ms | 0 |

Interpretation:

- The static frontend and hosting path stayed stable at 300 concurrent connections.
- This does **not** measure Supabase queries, auth, Worker uploads, Hugging Face, or production bandwidth.
- No breaking point was identified; higher-concurrency production/staging tests remain necessary.

## SEO and Routing

- 30 public routes receive route-specific title/description/canonical metadata.
- `sitemap.xml` contains 30 canonical URLs.
- `/s/*` uses `app-shell.html`; dynamic subject routes use `dashboard-shell.html`.
- Share and dashboard shells are `noindex, nofollow` and omit canonical metadata.
- Unknown paths return the static `404.html`.
- Legacy admin routes redirect with 301:
  - `/admin` → `/dashboard`
  - `/admin/` → `/dashboard`
  - `/admin/publish-requests` → `/dashboard/publish-requests`
  - `/admin/storage` → `/dashboard/storage`
- Cloudflare Pages redirects are always followed, even for existing assets. The final configuration intentionally avoids `/dashboard/*` and `/admin/*` catch-alls.
- Rewrite destinations use `/app-shell` and `/dashboard-shell`, not `.html`, because Pages redirects `.html` destinations to extensionless paths and would lose share tokens.
- Local Wrangler verification:
  - `/s/testtoken123` → 200
  - `/dashboard` → 200
  - `/dashboard/subjects` → 200 static canonical
  - `/dashboard/subjects/` → 200 shell, noindex
  - `/dashboard/subjects/abc` → 200 shell, noindex
  - `/admin/publish-requests` → 301 canonical dashboard URL
  - unknown path → 404

Production routing and headers still require a live verification pass.

## Accessibility and UX

- Lighthouse accessibility: **1.00**.
- Added an accessible name to the onboarding overlay dismiss button.
- Notification button exposes the unread count in its accessible label; the visual badge is a decorative dot.
- External links and primary navigation are keyboard-operable.
- The welcome overlay was moved from the top-center (where it covered the Explore heading) to the bottom-right on desktop and inset bottom on mobile.
- Screenshots added:
  - `docs/screenshots/home-hero.png`
  - `docs/screenshots/explore.png`
  - `docs/screenshots/home-mobile.png`

A manual screen-reader pass and reduced-motion review are still recommended before launch.

## Repository and Supply Chain

Added:

- `README.md` with badges, screenshots, features, architecture, environment, migration, Worker, deployment, and security sections.
- `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`.
- GitHub Actions secret scan using gitleaks.
- Dependabot for app, Worker, and Actions.
- `.gitleaks.toml` allowlist for examples, lockfiles, build output, and test fixtures.
- `.gitignore` entries for local agent/tooling state.

Other:

- Deleted outdated `HANDOFF.md`.
- `scripts/db-apply.mjs --list` is now read-only: it checks for `_app_migrations` instead of creating it during a listing.
- Secret scan across repository history: `NO_MATCHES`.
- No tracked `.env` or credential files; real credentials remain only in ignored local environment files.
- `npm audit` (app): **5 high, 2 moderate, 0 critical**, all in the Tailwind 3.4.19 development dependency chain. The only available fix is a Tailwind 4 major upgrade. `npm audit --omit=dev` reports **0 vulnerabilities** for both the app and the Worker.

## Open Risks

| Severity | Item | Status |
| --- | --- | --- |
| High | `0026`–`0028` not applied to staging/production | Blocker |
| High | Upload/quota/delete/CORS not tested end-to-end | Blocker |
| High | Auth, RLS, share, publish, rate-limit flows not exercised remotely | Blocker |
| High | Live Pages headers, CSP, HSTS, redirects, and 404 behavior unverified | Blocker |
| Medium | CSP still allows `script-src 'unsafe-inline'` and broad `*.workers.dev` | Documented |
| Medium | Local mobile LCP is 2.9s | Optimize/monitor |
| Medium | Tailwind dev dependency audit findings | Deferred major upgrade |
| Medium | `send-email` Edge Function source is absent; UI handles missing function | Backlog |
| Low | Search Console, Cloudflare Analytics, Dependabot, and branch protection need account configuration | Manual |
| Low | Backup branch/commit not yet created | Process |

## Production Checklist

1. Take a Supabase backup/snapshot.
2. Review pending migrations with `node scripts/db-apply.mjs --list` (read-only).
3. Apply `0026`–`0028` in order and verify functions, triggers, and RLS policies.
4. Configure Worker secrets and deploy `workers/hf-upload`.
5. Test successful upload, 90MB rejection, quota rejection, path traversal rejection, delete, and usage reconciliation.
6. Configure Pages `VITE_*` variables and deploy `app/dist`.
7. Verify production headers and redirects with `curl -I`:
   - HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, referrer, permissions
   - `/s/*`, `/dashboard`, `/dashboard/subjects`, `/dashboard/subjects/*`, `/admin/*`, unknown paths
8. Run authenticated E2E: login, upload, preview, saved list, share, publish request, approval, admin analytics.
9. Run rate-limit abuse tests and a staging load test that includes Supabase and the Worker.
10. Enable/verify Search Console, Cloudflare Web Analytics, Secret Scanning, Dependabot, and branch protection.
11. Re-run Lighthouse against production and record field data.
12. Create the backup commit/tag after final diff review.

## Go / No-Go

**Staging: GO — conditional.** The frontend and static behavior are ready. Apply the migrations, configure the Worker, and run the authenticated flows before inviting testers.

**Production: NO-GO.** The missing database application and untested storage/auth/Worker paths are release blockers. Production can move to GO after every item in the checklist passes on staging and live headers/routing are verified.

## Reproduction

```bash
# Frontend
cd app
npm run typecheck
npm run build
npx vite preview --port 4173

# Lighthouse (local mobile)
npx lighthouse http://localhost:4173/ \
  --output=json --output-path=lighthouse.json \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"

# Static load
npx autocannon -c 20 -d 10 http://localhost:4173/
npx autocannon -c 100 -d 10 http://localhost:4173/ai/year-1/sem-1
npx autocannon -c 300 -d 10 http://localhost:4173/ai/year-1/sem-1

# Worker typecheck
cd ../workers/hf-upload
npx tsc --noEmit
```

No secrets, access tokens, or service-role keys are included in this report.

## Final Verification Update

**Status:** Production deployed and smoke-tested after the audit snapshot above. This section supersedes the earlier NO-GO status where they conflict.

- Production: `https://dev-academy.pages.dev`; the alias was verified against deployment `https://6b81d0d7.dev-academy.pages.dev`.
- Build: `npm run typecheck` and `npm run build` pass. Prerender generated 30 public routes, 10 app shells, `404.html`, and the sitemap.
- Public SEO: title, Open Graph, and Twitter metadata use `Dev Academy | ديف أكاديمي — منصة تعليمية`; `FCAI` was removed from public metadata. `og-image.jpg` and `icon-512.png` return HTTP 200, `robots.txt` allows public pages, and `sitemap.xml` contains 30 URLs.
- UI smoke tests: production serves `assets/index-IcPKNGFv.js`; the homepage loads with no console errors. Announcement/notification layering, mobile overflow, share-card, and Admin Panel icon fixes were verified earlier.
- Security/data: the temporary QA account and its test rows were removed; the exposed Worker deploy token was revoked and deleted; the Pages token was rotated and is stored only in the local `.env`.
- Search indexing: metadata and crawl files are production-ready, but Google/Bing indexing and refreshed social-preview caches depend on third-party recrawls.
