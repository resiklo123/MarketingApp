# ContentOps Phase 1 窶・local setup

This app uses **Google Drive file IDs only** (staff upload to Drive; the dashboard never streams large uploads through Vercel).

## 1. Supabase (Postgres)

1. Create a project on [Supabase](https://supabase.com/).
2. Open **Project Settings 竊・Database** and copy:
   - **Connection string (URI)** 竊・`DATABASE_URL` (pooler / PgBouncer URL is fine for the app).
   - **Direct connection** string 竊・`DIRECT_URL` (used by Prisma migrations; often port `5432` without pooler).

Prisma expects both variables as documented in `prisma/schema.prisma`.

## 2. Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres URL for the app |
| `DIRECT_URL` | Direct Postgres URL for migrations |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON key for a Google service account (single-line string) |
| `DRIVE_INCOMING_FOLDER_ID` | Drive folder ID for `Marketing/Incoming` |
| `DRIVE_LIBRARY_FOLDER_ID` | Drive folder ID for `Marketing/Library` root |
| `OPENAI_API_KEY` | OpenAI API key for drafting |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from `@BotFather` |
| `TELEGRAM_CHAT_ID` | Destination chat or channel ID |
| `CONTENTOPS_PASSCODE` | Shared internal passcode for the dashboard |
| `CONTENTOPS_BASE_URL` | Public site base URL (used in Telegram links), e.g. `https://your-domain.com` |
| `CONTENTOPS_MASTER_SHEET_ID` | Google Sheets ID for the `PostingLog` master sheet mirror. Example: `1ECMb6ZqNaKZYdrcHusm7mZZ48K57nh3hWGXjGNJ5jTQ` |
| `UPSTASH_REDIS_REST_URL` | Optional; wired in code, not required for MVP |
| `UPSTASH_REDIS_REST_TOKEN` | Optional |
| `CONTENTOPS_TEST_MODE` | Set to `true` to stub Drive/OpenAI/Telegram in `POST /api/contentops/posts` and smoke tests |
| `CONTENTOPS_CTA_URL` | Optional; default `https://resiklo.com` 窶・included in OpenAI prompt |
| `CONTENTOPS_OPENAI_MODEL` | Optional; default `gpt-4o-mini` |
| `CONTENTOPS_PRISMA_DATABASE_URL` | Optional; overrides the DB URL used by the Prisma **client** at runtime (migrations still use `DATABASE_URL` / `DIRECT_URL` from the schema). Set this to the same value as `DIRECT_URL` if your pooled `DATABASE_URL` hits `prepared statement already exists` errors locally. |

Copy `.env.local` (not committed) and fill the values.

For this project, set:

```bash
CONTENTOPS_MASTER_SHEET_ID=1ECMb6ZqNaKZYdrcHusm7mZZ48K57nh3hWGXjGNJ5jTQ
```

## 3. Google Drive sharing

1. Create a Google Cloud project and enable the **Google Drive API**.
2. Create a **service account** and download a JSON key.
3. Put the entire JSON into `GOOGLE_SERVICE_ACCOUNT_JSON` (escape quotes if you store it as a single line in `.env`).
4. In Drive, create folders such as `Marketing/Incoming` and `Marketing/Library`.
5. **Share both folders** with the service account email (Editor). Copy each folder窶冱 ID from the URL (`folders/<ID>`).

The worker will list children of `DRIVE_INCOMING_FOLDER_ID` and create canonical folders in `Library/<MachineFamily>/<MachineModelOrUnknown>/<YYYY>/<MM>/<slug>/` under `DRIVE_LIBRARY_FOLDER_ID`. It also writes non-duplicate shortcuts into `Library/_ByMachine/<MachineFamily>/<MachineModelOrUnknown>/` and `Library/_ByDate/<YYYY>/<MM>/`.

## 4. Telegram chat ID

1. Create a bot with [@BotFather](https://t.me/BotFather), set token 竊・`TELEGRAM_BOT_TOKEN`.
2. Send a message to the bot (or post in a channel where the bot is admin).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id` (channels often look like `-100xxxxxxxxxx`).

Set that value as `TELEGRAM_CHAT_ID`.

## 5. Local commands

```bash
npm install
npm run prisma:migrate
npm run dev
```

`npm run prisma:migrate` runs `prisma migrate dev` via the **`dotenv` CLI** (from the `dotenv-cli` package) so **`.env.local` is merged** after `.env` (Prisma alone only reads `.env` by default). For production-only apply, use `npm run prisma:deploy` with the same env files, or run `prisma migrate deploy` in a shell that already exports `DATABASE_URL` / `DIRECT_URL`.

In another terminal (optional):

```bash
npm run smoke:contentops
```

Smoke test behavior:

- Verifies DB connectivity (and that the `Post` table exists).
- For this script only, if `CONTENTOPS_PRISMA_DATABASE_URL` is unset and `DIRECT_URL` is set, the script points the Prisma client at `DIRECT_URL` so short-lived runs are less likely to hit pooler/prepared-statement quirks than a pooled `DATABASE_URL`.
- Calls Drive `listIncomingFiles` when credentials and `DRIVE_INCOMING_FOLDER_ID` exist.
- Optionally calls `GET /api/contentops/incoming` when `CONTENTOPS_BASE_URL` and `CONTENTOPS_PASSCODE` are set (dev server must be running and `CONTENTOPS_BASE_URL` must match that server).
- With `CONTENTOPS_TEST_MODE=true`, creates a stub post via the same processor used by the API.

## 6. Vercel

Add the same environment variables in the Vercel project. Run migrations against production from your machine:

```bash
DATABASE_URL="窶ｦpooler窶ｦ" DIRECT_URL="窶ｦdirect窶ｦ" npx prisma migrate deploy
```

Ensure `CONTENTOPS_BASE_URL` matches the deployment URL so Telegram links resolve.

## 7. Verification checklist

1. Create a post with **2 images** (example: `machineFamily=Balers`, `machineModel=RHB-5T`, `topic=Product shot`).
2. Confirm canonical move path:
   - `Library/Balers/RHB-5T/YYYY/MM/<slug>/`
3. Confirm shortcuts (no file duplication):
   - `Library/_ByMachine/Balers/RHB-5T/`
   - `Library/_ByDate/YYYY/MM/`
4. Re-run the same processing flow and verify shortcut names are not duplicated.
5. Open post detail page and save Posting Log links (FB/IG/etc). Refresh page and verify values + last-updated timestamps persist.
6. On New Post page, verify submit is blocked with visible errors if no file or no platform is selected.

## 8. Machine model combobox smoke checklist

1. Select `Granulator` and click `▼` on Machine model/type. Confirm `RPC300`, `RPC500`, `RPC600` are visible without typing.
2. Type `RPC` and confirm the dropdown filters to matching options.
3. Type a new model like `RPC700`, create a post, then return to New Post and reselect `Granulator`. Confirm `RPC700` appears in suggestions.
4. Switch `machineFamily` between options and confirm suggestions refresh per family.

## 9. PostingLog mirror (Google Sheets) minimal test plan

1. Create a post and confirm one row appears in `PostingLog` for that `postId`.
2. Change status in UI and confirm the same row updates (no duplicate `postId` row).
3. Add an FB link in Posting Log UI and confirm the same row updates the `FB_Url` column.
