# Contributing to Dev Academy

Thanks for helping improve the platform.

## Workflow

1. Create a branch from `main`.
2. Install dependencies with `npm --prefix app install` (and `npm --prefix workers/hf-upload install` if touching the Worker).
3. Make a focused change; avoid unrelated formatting churn.
4. Run the checks below.
5. Open a pull request describing the change, the user impact, and any migration or deployment steps.

## Checks

```bash
npm --prefix app run typecheck
npm --prefix app run build
npm --prefix workers/hf-upload run typecheck
```

If you change SQL, add a new numbered migration in `db/migrations/`; never edit an already-applied migration. Explain how to roll back or re-run it safely.

## Code guidelines

- Keep UI copy consistent with the existing Arabic/English style.
- Never commit `.env`, `.dev.vars`, credentials, tokens, or service-role keys.
- Use the shared Supabase client and existing hooks instead of ad-hoc clients.
- Validate and authorize on the server/database, not only in React.
- Add accessible names to icon-only buttons and preserve keyboard navigation.
- Prefer existing UI components and Tailwind tokens over new one-off styles.

## Security changes

Read [SECURITY.md](SECURITY.md) before changing auth, RLS, storage, or sharing code. Security-sensitive PRs should include a short threat-model note and a regression test or reproducible manual check.

## Reporting bugs

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, browser/device, and console/network errors with secrets redacted.
