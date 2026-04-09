Project ref: `ozjddzasadgffjjeqntc`
Region: `ap-southeast-2`
Date observed: `2026-04-08`

Summary:
- Please preserve all current data exactly as-is. Do not restore an older backup unless explicitly approved.
- Please snapshot the current database volume before any restart, rollback, or invasive recovery action.
- The app is in emergency read-only mode on our side and scheduled courier sync has been paused via Edge Function guard.

Observed behavior:
- Supabase Management API reports project status `ACTIVE_HEALTHY`.
- Supabase public status page shows region `ap-southeast-2` operational.
- Authenticated REST requests to the project time out after ~20 seconds.
- `npx supabase inspect db ... --linked` fails while creating the temporary login role with:
  `Failed to create login role: Connection terminated due to connection timeout`
- Public read/write dependent services appear unhealthy from the dashboard perspective: database, postgrest, auth, and storage.

Evidence collected:
- Physical backups available through `2026-04-07T16:14:00.171Z`
- PITR is disabled
- Reproduced timeout from:
  - SQL Editor / DB-backed requests
  - `rest/v1/customers?select=id&limit=1`
  - `auth/v1/settings`
  - `supabase inspect db long-running-queries --linked`

Likely trigger window:
- Recent migrations on `2026-04-07` to `2026-04-08`, especially:
  - `supabase/migrations/20260407120500_wallet_backfill.sql`
  - `supabase/migrations/20260408113000_add_soft_delete_support.sql`
  - `supabase/migrations/20260408150000_apply_wallet_cutoff_april_2026.sql`

Please investigate:
1. Whether Postgres is blocked by a long-running migration, stuck backend, or exhausted connections.
2. Whether any index creation, view replacement, or backfill query is still running or left the database in a partial state.
3. Provider-side logs for Postgres, PostgREST, Auth, and Storage around the first occurrence of the timeout.
4. Whether a safe instance restart is possible after snapshotting current state, without data loss.

Important constraint:
- Zero data loss is required.
