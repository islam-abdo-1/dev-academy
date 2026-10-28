# Supabase Edge Functions (archived sources)

> **No Edge Functions are deployed.** All five functions were deleted from project
> `uytyvnoqhqivvhujdxoc` on 2026-10-28 after confirming that nothing in
> `app/src` invokes them. The files here are kept as historical reference only.
> Do not redeploy them without adding authentication and role checks first.

There is no `supabase/config.toml` in this repository. The functions were
originally deployed from the dashboard or CLI and downloaded here for
reproducibility.

| Function | Source | Production | Used by app | Why it was removed |
| --- | --- | --- | --- | --- |
| `invite-user` | repo (hardened) | deleted 2026-10-28 | no | Email invites are impossible while the Supabase Email provider is disabled; the deployed v2 also predated the CORS hardening here. |
| `process-upload-queue` | downloaded 2026-10-28 | deleted 2026-10-28 | no | Stub that "simulated" uploads. `upload_queue` was empty. |
| `check-quotas` | downloaded 2026-10-28 | deleted 2026-10-28 | no | Stub that estimated quotas. Quota tables were empty. |
| `refresh-hf-tokens` | downloaded 2026-10-28 | deleted 2026-10-28 | no | No-op that only logged. |
| `create-hf-permission` | downloaded 2026-10-28 | deleted 2026-10-28 | no | Used `HF_TOKEN` without a role check and called a non-existent Hugging Face endpoint. |

## Notes

- The app uses Cloudflare Pages Functions and the `workers/hf-upload` Worker for
  the active upload path; Supabase Edge Functions are not part of it.
- If a function is needed later, add an explicit caller check
  (`super_admin`/`is_staff`) and a least-privilege secret, then verify with the
  anon key that the call is rejected.
- The old sources can be refreshed from git history if ever required.
