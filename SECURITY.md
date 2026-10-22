# Security Policy

## Supported versions

Only the latest deployment of Dev Academy (`main` branch / current Cloudflare Pages production deployment) is supported with security fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Send a private report to the maintainer with:

- A short description of the issue and affected page/endpoint.
- Steps to reproduce (use a test account, never another person's data).
- Impact assessment (what an attacker could read, change, or delete).
- Any suggested fix or relevant request/response samples with secrets removed.

Contact: **islamabdo** via the GitHub profile linked in [README.md](README.md), or the contact address published on the site.

You should receive an initial response within 72 hours. Please allow time for a fix and coordinated disclosure before publishing details.

## Scope

In scope:

- Authentication and authorization bypasses (RLS, staff RPCs, share tokens).
- Cross-user data access (IDOR) through the app, Supabase API, or upload Worker.
- Stored/reflected XSS, unsafe HTML previews, open redirects.
- Arbitrary file read/write/delete through the upload Worker or storage RPCs.
- Secret exposure in the client bundle, repository history, or public endpoints.
- Quota/rate-limit bypass that enables abuse or unexpected cost.

Out of scope:

- Denial of service through volumetric attacks against Cloudflare/Supabase infrastructure.
- Missing security headers with no demonstrated impact.
- Reports from automated scanners without a reproducible impact.
- Social engineering, physical access, or compromised user devices.

## Safe harbor

Good-faith research on your own account or a local/staging copy is welcome. Do not access, modify, or exfiltrate other users' data, do not run destructive load tests against production, and do not publicly disclose an unresolved issue.
