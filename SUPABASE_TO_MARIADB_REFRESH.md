Run `npm run backend:refresh-from-supabase`.

What it does:
- drops and recreates the local MariaDB database
- reapplies the MariaDB schema
- imports all supported tables from Supabase using read-only REST requests
- reapplies local-only post-import patches from `backend/database/post_import.sql`

Notes:
- Supabase is not modified
- local MariaDB data is fully replaced
- local DB credentials come from `.env.local` / backend config, defaulting to `root` with no password
- the current local-only patch promotes `01404020000` to `Developer` after each refresh
