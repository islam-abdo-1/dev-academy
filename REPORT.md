# Dev Academy — Launch Readiness Report

**Date:** 2026-10-23

**Scope:** Security hardening, private storage, storage/quota correctness, accessibility, SEO, performance, repository hygiene, and deployment readiness.

**Constraint:** Production writes were limited to QA uploads, the Hugging Face bucket privacy setting, Pages deployments, admin password rotation, and temporary restore-database creation; no destructive load/fuzz testing was performed. QA fixtures, users, objects, and temporary credentials were removed after verification, and the restore database was dropped.

> **Final verification update (2026-10-23):** Production is now Cloudflare Pages deployment `503fcb76` on `https://dev-academy.pages.dev` with `assets/index-jupyOKy1.js` and `assets/index-B_28QPb6.css`. Private personal files use the authenticated same-origin Pages Function `/api/hf-file/*`, the Hugging Face bucket is private and empty, and PDF preview is verified in production. Turnstile is configured and enforced by Supabase Auth, the encrypted off-site backup is verified, and the daily backup task is registered. Public launch remains **NO-GO** only for SMTP; PITR is unavailable on the current plan but is mitigated by the encrypted off-site backup. See **Final Production Verification & Decision** and **Private Storage & Final Verification (2026-10-23)** at the end; these sections supersede earlier storage, deployment, and GO/NO-GO statements.

## Executive Summary

- The two most serious application risks are fixed in source and the pending hardening migration: cross-user file exposure through saved-list JSON, and Worker object-path traversal. They become effective after deployment and migration application.
- Storage accounting now uses reservation/confirmation/release RPCs with server-side quota checks; client-side quota bypasses were revoked in the pending hardening migration.
- The application builds cleanly, typechecks, and scores **1.00 for accessibility and SEO** in Lighthouse.
- Static local load tests sustained ~**4.0k–4.9k requests/second** with zero errors; no breaking point was found at 300 concurrent connections.
- Production remains **NO-GO for public launch only for SMTP**; Turnstile and encrypted off-site backup are now closed. Migrations `0001`–`0033` are applied, private storage/PDF/admin flows are verified, and live Cloudflare headers/redirects have been checked.
- A one-time logical database/media backup and restore verification are complete, the encrypted off-site archive is verified, and a daily backup task is registered; staging/limited launch can proceed with public registration disabled until SMTP is configured.

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
| Remote migrations | PASS | `0001`–`0033` applied, pending `0` |
| Authenticated E2E | PASS | Login, session, profile, dashboard, settings, team, publish requests, storage, sign-out |
| Production headers/routing | PASS | Live Cloudflare headers and redirects verified |

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

## Latest Source Update

**Date:** 2026-10-22
**Status:** Source changes complete, built, and locally smoke-tested. **Not deployed.** This section supersedes earlier local performance notes only; the release blockers and NO-GO conditions above remain in force.

### Changes

- `AuthContext` now loads Supabase through a retryable dynamic import, resets the promise after a failed import, and cleans up the auth subscription on unmount.
- `NotificationBell` and `PublicSearchDialog` are lazy-loaded from the public header; Home lazy-loads search and onboarding. The initial HTML preloads only React/UI chunks, not Supabase.
- Inter Latin is self-hosted at `/fonts/inter-latin.woff2` (48,256 bytes), preloaded with `font-display: optional`; Google Fonts is used only for JetBrains Mono and Great Vibes.
- Duplicate-submit guards were added to `QuickSaveDialog`, `TasksPanel`, and `DashboardTeam`.
- Inline-dist-CSS and delayed-boot experiments did not reliably improve LCP and were not adopted.
- The temporary mobile `text-base` hero experiment was reverted to the original `text-lg sm:text-xl` scale.

### Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; 30 routes, 11 app shells, `404.html` |
| Home smoke | PASS; boot overlay removed, hero rendered, Inter loaded, search/bell present |
| Console | Only Cloudflare RUM CORS failures; no application errors |
| Local mobile CLS | `0` in every post-`display=optional` run |
| Local mobile performance | `0.88`–`0.98`; LCP `1.96`–`3.42 s`; TBT `27`–`50 ms`; noisy shared-machine benchmark |

Local Lighthouse results are not release evidence: runs varied materially with concurrent browser activity, and the best run (`0.98`, LCP `1.96 s`) was not reproducible. Production PSI/field data must be collected after deployment.

### Remaining release blockers

- SMTP is unconfigured; verification and password-reset delivery are not ready for public use.
- PITR is unavailable on the current plan; the encrypted daily off-site backup is the documented mitigation.
- Final commit/tag `launch-readiness-2026-10-23` is created after the final diff review.

**Decision:** Production remains **NO-GO for public launch** until SMTP is configured and verified. Turnstile, private storage, and automated/off-site backup are closed. Limited/internal launch can proceed with public registration disabled.

---

## Final Production Verification & Decision

**Date:** 2026-10-23

**Deployment:** Cloudflare Pages `503fcb76` on `https://dev-academy.pages.dev` (also `https://503fcb76.dev-academy.pages.dev`)

**Production asset:** `assets/index-jupyOKy1.js`, `assets/index-B_28QPb6.css`; HTML ETag `"4c5466a2b98128f1560e05c4f74077ff"`

**Source state:** HEAD `d97eccc` plus the launch-readiness changes; the final source commit and tag `launch-readiness-2026-10-23` are created after this report. Production was deployed with `--commit-dirty=true`.

### Changes since the audit

- Created and applied `0031_publish_request_revisions.sql`; the delete policy now allows own `pending` and `needs_changes` requests.
- Created and applied `0032_share_expiry_upload_dedupe.sql`; new share links default to 30 days, existing links were backfilled, and personal-file deduplication is enforced by `(user_id, sha256_hash)`.
- Closed the client-side duplicate-upload race with hash preflight plus `23505` compensation; cross-tab races are covered by the database index.
- Added Arabic 30-day expiry disclosure to both share dialogs.
- Deferred non-critical `WelcomeOverlay` loading by 2.5 seconds, stopped anonymous pages from mounting `NotificationBell`, and stopped closed search dialogs from loading.
- Production mobile Lighthouse improved from `89` performance / LCP `3.2s` to `99` / LCP `1.5–2.0s` across two consecutive runs.
- Added `workers/hf-upload/functions/api/hf-file/[[path]].ts` and `app/public/_routes.json`; personal-file reads now use authenticated same-origin `/api/hf-file/*` with owner, file-share, and list-share authorization.
- Uploads now rewrite saved URLs to `/api/hf-file/*`; the Hugging Face bucket is `private:true` and direct anonymous S3 access returns `403`.
- Fixed the production Profile crash caused by a missing `safeHttpUrl` import and replaced the remaining `???` tooltip.
- Fixed PDF preview by removing the iframe `sandbox` attribute; verified both authenticated personal PDFs and public share PDFs in production.

### Verification results

| Gate | Result |
| --- | --- |
| App TypeScript | PASS |
| Production build + prerender | PASS; 30 public routes, 11 app shells, `404.html` |
| Supabase migrations | PASS; `0001`–`0033` applied, pending `0` |
| `0031` delete policy | PASS; authenticated transaction test, rolled back |
| `0032` trigger/backfill/index | PASS; 2 share tokens expire `2026-11-21`; duplicate groups `0` |
| `0033` broadcast idempotency | PASS; retry `0` inserted, duplicate `1`; batch mismatch rejected |
| `create_share_link` | PASS; 30-day expiry verified in transaction, rolled back |
| Authenticated E2E | PASS; login, session, profile, dashboard routes, settings, team, publish requests, storage, sign-out |
| Public share view | PASS; valid file/list tokens load, expired/wrong tokens rejected |
| Private Pages Function | PASS; anonymous private `404`; owner `200`; file-share `200`; list-share `200`; wrong/expired `404`; Range `206`; download attachment; HEAD `200`; OPTIONS `204`; POST `405` |
| Storage-ledger orphan | PASS; object with `storage_objects` row but no personal-file row: anonymous `404`, owner `200`, direct S3 `403` |
| Private bucket | PASS; `private:true`, direct anonymous S3 `403`, proxy owner `200` |
| Production UI upload | PASS; upload returned `/api/hf-file/...`, preview opened without sandbox, delete removed DB row and object |
| QA cleanup | PASS; temporary QA rows and objects removed; global storage used/reserved `0`; existing production users/tokens untouched |
| Production smoke | PASS; 17 key routes, `0` uncaught errors after Profile fix; production Lighthouse `99/100/100/100` |
| Production headers | PASS; HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, CSP, referrer and permissions policies |
| PageSpeed Insights API | NOT AVAILABLE; unkeyed `429`, keyed `403` |
| Real HF upload/delete/quota/path E2E | PASS on 2026-10-23 with temporary user and cleanup |
| Working admin access | PASS; `admin@devacademy.dev` password grant login, `super_admin`, admin RLS `publish_requests` `200 []`; password rotated and stored in `ACCOUNTS-CREDENTIALS.txt` |
| Supabase logical backup | PASS; custom dump `626,776` bytes covering `public`/`auth`/`storage`; 335 `media` objects backed up (`890,058,704` bytes) with MD5/SHA256 manifests |
| Restore verification | PASS; restored into a temporary database; row counts/checksums matched source; `65` tables, `3` views, `97` policies, `72` functions, `229` indexes; test DB dropped |
| Encrypted off-site backup | PASS; `dev-academy-20261023_040149.7z` is `734,725,875` bytes, SHA256 `4fc7a889bbddcb50d002f0f746c45ac889e7b5741aa193ad2393ec38e2ba4cbc`, copied to OneDrive and hash-verified |
| Scheduled backup | REGISTERED; Windows task `DevAcademy Offsite Backup` is Ready, runs daily at 12:00, and skips the public HF dataset bulk copy. The manual wrapper/script run passed; a scheduler test run was terminated when the interactive session ended, so validate once on an active desktop session |
| HF dataset coverage | DOCUMENTED; 144 public files/`3,750,683,172` bytes are inventoried in `hf-inventory.tsv`; they are public/reproducible and excluded from the encrypted archive |
| Backup/PITR posture | PARTIAL; encrypted daily off-site backup verified; PITR is unavailable/paid |
| Turnstile | PASS; widget `Dev Academy Auth`, site key configured, Supabase Auth captcha enforced (`no captcha_token found` / `invalid-input-response` verified); headless automation cannot complete the human challenge |
| SMTP | BLOCKED; no SMTP credentials and `smtp_host=false`, `smtp_user=false`, `mailer_autoconfirm=false` |

### Remaining launch risks

| Severity | Risk | Status |
| --- | --- | --- |
| Critical | SMTP is unconfigured (`smtp_host=false`, `smtp_user=false`, `mailer_autoconfirm=false`) | Open |
| High | Scheduled/off-site backup now verified; PITR remains unavailable on the current plan | Mitigated by encrypted daily off-site backup |
| High | Captcha/Turnstile configured and enforced; human challenge not completed by headless automation | Closed with browser-validation caveat |
| High | Working admin credentials after QA admin cleanup | Closed 2026-10-23 |
| High | Real Worker upload/delete/quota/path E2E not exercised in production | Closed 2026-10-23 |
| High | Personal files were reachable through public Hugging Face URLs | Closed 2026-10-23 |
| High | Orphaned storage-ledger objects could bypass personal-file privacy | Closed 2026-10-23 |
| Medium | Broadcast retry after partial failure may duplicate messages | Closed by `0033` |
| Medium | Legacy Supabase `media` bucket is public (335 objects, ~849 MiB) | Documented; separate from private HF personal files |
| Medium | CSP still allows `script-src 'unsafe-inline'` and broad `*.workers.dev` | Documented |
| Low | Real-PDF Chrome sandbox verification not repeated | Closed 2026-10-23 |
| Low | Oversized declared `Content-Length` HTTP 413 not reproduced through Cloudflare | Open; Worker code check exists |

## Private Storage & Final Verification (2026-10-23)

- **Deployment:** Cloudflare Pages `503fcb76`, `https://dev-academy.pages.dev`; final hardening denies anonymous access to orphaned user-storage ledger objects.
- **Architecture:** `workers/hf-upload/functions/api/hf-file/[[path]].ts` is deployed as a Pages Function; `app/public/_routes.json` routes only `/api/hf-file/*` to it. Personal uploads store `/api/hf-file/...` URLs, while the existing Worker keeps `POST /upload` and `DELETE /delete` on `dev-academy-hf-upload`.
- **Turnstile:** widget `Dev Academy Auth`, site key `0x4AAAAAAFh42pNj3E6kQSk_` for `dev-academy.pages.dev`, managed mode; `security_captcha_enabled=true` with provider `turnstile` in Supabase Auth. Missing tokens return `captcha_failed` / `no captcha_token found`; invalid tokens return `invalid-input-response`. The widget loads in production, but headless automation is flagged and cannot complete the challenge.
- **Access control:** owner bearer; file-share token; list-share membership; expired and wrong tokens return `404`; unrecorded course assets remain public; user objects recorded in `storage_objects` without a personal-file row require the owner bearer.
- **Bucket:** `devacademy-fcai/devacademy-media` is `private:true`, `size:0`, `totalFiles:0`; direct anonymous S3 GET returns `403`.
- **Backup set:** `exports/backups/2026-10-23/` contains a `626,776`-byte custom logical dump of `public`/`auth`/`storage`, all 335 legacy `media` objects (`890,058,704` bytes), `media-inventory.tsv`, MD5/SHA256 manifests, and a casefold map for the two case-only object names (`Task 2.pdf` / `task 2.pdf`). `exports/` is gitignored.
- **Restore proof:** the dump restored into a temporary database; source/restore counts and key-table checksums matched (`16` users/profiles, `2` share tokens, `33` migrations, `46` subjects, `155` lectures, `335` Supabase `storage.objects` legacy media rows), with `65` tables, `3` views, `97` policies, `72` functions, `229` indexes, and `54` RLS tables. The temporary database was dropped.
- **Restore caveat:** validation used `pg_restore --no-owner --no-privileges` because Supabase default ACLs are owned by `supabase_auth_admin`; a production restore should run as `supabase_admin` or reapply grants/migrations.
- **Encrypted off-site backup:** `exports/backups/dev-academy-20261023_040149.7z` is `734,725,875` bytes with SHA256 `4fc7a889bbddcb50d002f0f746c45ac889e7b5741aa193ad2393ec38e2ba4cbc`; the archive is encrypted with `-mhe=on`, copied to `C:\Users\islam\OneDrive\DevAcademyBackups\20261023_040149\`, and the copy hash matches. It contains the database dump, all 335 Supabase `media` objects, media manifests, and the HF inventory.
- **Scheduled backup:** Windows task `DevAcademy Offsite Backup` is `Ready`, runs daily at `12:00`, uses `scripts/run-backup-offsite.ps1`, keeps 14 days locally/off-site, and sets `BACKUP_INCLUDE_HF=0` so the 3.75 GiB public HF dataset is inventoried rather than re-downloaded on every run. The manual wrapper/script path passed; a scheduler test run was terminated when the interactive session ended, so validate once on an active desktop session.
- **HF dataset:** `devacademy-fcai/devacademy-media` contains 144 public files (`3,750,683,172` bytes) under `drive/` and `imports/`; `hf-inventory.tsv` records the full list. It is public and reproducible, so the encrypted archive deliberately excludes the bulk files. The private HF bucket remains empty.
- **Backup posture:** PITR is disabled/paid; the encrypted daily off-site backup with 14-day retention is the mitigation. The legacy Supabase `media` bucket is public (`335` objects, ~849 MiB) and separate from the private HF personal-file bucket.
- **SMTP:** remains unconfigured (`smtp_host=false`, `smtp_user=false`, `mailer_autoconfirm=false`). Cloudflare Email Service SMTP (`smtp.mx.cloudflare.net:465`, username `api_token`) was evaluated but requires Workers Paid/Email Sending, so it was not enabled under the no-paid-resource constraint.
- **Admin access:** `admin@devacademy.dev` (`ddbae3be-fe9c-40bc-9875-3a9fe8d2ca76`, `super_admin`) password grant login passed, profile role is `super_admin`, and admin RLS probe returned `200 []`; password was rotated and stored only in `ACCOUNTS-CREDENTIALS.txt`.
- **Existing production data:** `16` auth users/profiles, `2` `lecture_item` share tokens expiring `2026-11-21`, and `335` Supabase `media` objects remain; app `storage_objects`, `storage_reservations`, and upload queue are `0`; HF bucket is empty.
- **Production proxy checks:** anonymous private `404`; owner/file-share/list-share `200`; wrong/expired `404`; storage-ledger orphan anonymous `404` and owner `200`; anonymous unrecorded course asset `200`; Range `206`; download attachment; HEAD `200`; OPTIONS `204`; POST `405`; CORS restricted to the production origin.
- **UI checks:** authenticated profile upload returned a proxy URL and previewed the PDF; file-share and list-share public pages previewed the same PDF; expired share page showed the Arabic error state; profile no longer crashes and the tooltip is `فتح الملف`.
- **PDF:** production public and authenticated previews render with `sandbox=null`; evidence in `qa-private-proxy-profile.png` and `qa-private-proxy-share.png`.
- **Cleanup:** temporary QA auth user/profile, personal file, saved list/items, share tokens, storage objects/reservations/usage, HF objects, and temporary credentials were deleted. Temporary test rows are `0`; global storage used/reserved are `0`; existing production users and share tokens were left untouched.
- **Operational note:** Pages Functions deployment is reproducible only when `wrangler pages deploy ../../app/dist ...` runs from `workers/hf-upload` so the `functions` directory and `aws4fetch`/`jose` resolve.

### القرار النهائي (Final Decision)

**الإطلاق العام: NO-GO.**

النسخة المنشورة `503fcb76` اجتازت البناء والمصادقة والمشاركة واختبارات الرفع/الحذف/الحصة/المسار في الإنتاج، وأصبحت ملفات المستخدمين الشخصية محمية عبر Pages Function و`/api/hf-file/*` مع bucket خاص، وأوراق التخزين اليتيمة مالك-فقط. تم إغلاق مخاطر PDF وروابط Hugging Face العامة وتكرار البث، وتم التحقق من حساب إداري عامل بعد تدوير كلمة مروره. Turnstile مُفعّل ومفروض على Supabase Auth، وتم إنشاء نسخة احتياطية مشفرة خارج الموقع (734,725,875 بايت) والتحقق من الـhash بعد النسخ إلى OneDrive، مع مهمة نسخ احتياطي يومية مجدولة. تم توثيق 144 ملفًا عامًا من Hugging Face (3.75GiB) في inventory بدل تضمينها في الأرشيف لأنها عامة وقابلة لإعادة التنزيل. يبقى الإطلاق العام غير آمن بسبب **SMTP فقط**؛ PITR غير متاح في الخطة الحالية لكن النسخ المشفر اليومي يغطيه كإجراء تخفيف.

**إطلاق محدود/تجريبي: GO بشرط.**

يمكن استخدام النسخة الحالية لعرض محدود أو فريق داخلي مع تعطيل التسجيل العام، حتى يتم إغلاق بند SMTP. التخزين الشخصي خاص والنسخ الاحتياطي المشفر يعمل، لكن يجب عدم رفع بيانات حساسة قبل تفعيل SMTP والتحقق اليدوي من Turnstile.

**شرط التحويل إلى GO للإطلاق العام:**

1. إعداد SMTP موثوق وتأكيد وصول رسائل التحقق وإعادة التعيين.
2. التحقق اليدوي من تحدي Turnstile في متصفح حقيقي (الأتمتة الحالية تظهر كبوت).
3. إنشاء commit/tag نهائي وإعادة تشغيل smoke/regression بعد أي تغييرات تشغيلية.

The performance target is now met in production. The release decision is driven by operational controls and data-protection gaps, not by the frontend or the current Lighthouse score.
