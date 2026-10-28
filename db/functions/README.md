# Supabase Edge Functions

Sources for the functions deployed to project `uytyvnoqhqivvhujdxoc`. There is
no `supabase/config.toml` in this repository; functions are deployed from the
dashboard or CLI and tracked here for reproducibility.

| Function | Source | Deployed | `verify_jwt` | Used by app | Status |
| --- | --- | --- | --- | --- | --- |
| `invite-user` | repo (hardened) | v2, older | yes | no | Legacy email invite. Supabase Email provider is disabled. |
| `process-upload-queue` | downloaded 2026-10-28 | v1 | yes | no | Stub: "simulates" uploads. `upload_queue` is empty. |
| `check-quotas` | downloaded 2026-10-28 | v1 | yes | no | Stub: estimates quotas. Quota tables are empty. |
| `refresh-hf-tokens` | downloaded 2026-10-28 | v1 | yes | no | No-op; only logs. |
| `create-hf-permission` | downloaded 2026-10-28 | v1 | yes | no | Stub; uses `HF_TOKEN` without a role check. |

## Notes

- The deployed `invite-user` (v2) predates the CORS allowlist hardening in this
  repository. The local file is the source of truth, and the UI no longer calls
  this function.
- The four stub functions are deployed but unused: `cloud_storage_accounts`,
  `upload_queue`, `daily_upload_stats`, and `storage_quota_logs` all have zero
  rows, and nothing in `app/src` invokes them. They should be deleted or gated
  to `super_admin` before public launch; `create-hf-permission` accepts calls
  from any client holding the public anon key and spends the project's
  `HF_TOKEN`.
- Refresh the sources with:
  `supabase functions download --project-ref <ref> --use-api --workdir <tmp>`
  (requires `SUPABASE_ACCESS_TOKEN`).
- Runtime secrets: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected
  by Supabase; `HF_TOKEN` is required by `check-quotas` and
  `create-hf-permission`; `HF_CLIENT_ID` / `HF_CLIENT_SECRET` are reserved for
  a future token refresh implementation.
