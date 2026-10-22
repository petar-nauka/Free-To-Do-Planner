# Free To-Do Planner (Supabase)

[![CI](https://github.com/petar-nauka/Free-To-Do-Planner/actions/workflows/ci.yml/badge.svg)](https://github.com/petar-nauka/Free-To-Do-Planner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

🇧🇬 [Прочети на български](README.bg.md)

A free, self-hosted planner for **projects, tasks, notes and spreadsheets**, built with React and Supabase.
You can run it on your own computer or server, and all data stays in **your own** Supabase database.

> **Interface language:** Bulgarian. An English translation exists for part of the UI (i18next).

## Features

- Projects with Kanban boards: drag & drop, tags, comments, file attachments, Google Keep-style task colors with a color filter
- Priority tasks, "Plan for today", recurring tasks, reminders, calendar
- Notes with version history and a trash bin
- Spreadsheets with formulas
- Whiteboards for drawing and sketching (Excalidraw)
- Time tracking, global search, permanent links to projects, notes and tasks
- Shared projects: invite other users by e-mail
- E-mail reminders, overdue-task alerts and a weekly report (optional backend)
- Optional: voice notes with speech-to-text (Soniox), n8n integration, workout tracker
- Mobile-friendly and installable on the phone as an app (PWA)

## How it works

```
Browser (React app) ───────► Supabase: Postgres + Auth + Storage
                                 ▲   (access rules enforced in the database
Optional Python backend ─────────┘    by Row-Level Security policies)
(sends scheduled e-mails)
```

The frontend talks to Supabase directly. You don't need an application server for the main app.
Only static files are served.

## Requirements

- **Node.js 20+** (22 recommended) and npm
- A **Supabase** project: the free tier on [supabase.com](https://supabase.com) or [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting)
- For a server: **Docker** with the Compose plugin
- Optional e-mail backend: **Python 3.12**

---

## 1. Create the database (once)

1. Create a **new, empty** Supabase project.
2. Open **SQL Editor**, paste the whole of [`database/install.sql`](database/install.sql) and click **Run**.
   This creates all 24 tables, the security policies, functions, triggers and the `attachments` storage bucket.
   Run it **only once**, on an empty project.
3. **Authentication → URL Configuration:** set **Site URL** to the address of the app:
   `http://localhost:3000` locally, or `https://your-domain` on a server.
   Sign-up confirmation e-mails link there.
   *Quick local test:* you can turn off **Confirm email** under Authentication → Providers → Email.
4. **Project Settings → API:** copy the **Project URL** and the **anon / publishable key**.

## 2a. Run locally

```sh
git clone https://github.com/petar-nauka/Free-To-Do-Planner.git
cd Free-To-Do-Planner/frontend
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm ci
npm run dev                 # → http://localhost:3000
```

## 2b. Run on a server (Docker)

```sh
git clone https://github.com/petar-nauka/Free-To-Do-Planner.git
cd Free-To-Do-Planner
cp .env.example .env        # fill in the two VITE_ values
docker compose up -d --build
curl -I http://127.0.0.1:8100   # expect: HTTP/1.1 200 OK
```

The container listens on `127.0.0.1:8100` only. Put a reverse proxy with HTTPS in front of it.
The shortest setup uses [Caddy](https://caddyserver.com), which obtains the certificate automatically:

```
todo.example.com {
    reverse_proxy 127.0.0.1:8100
}
```

Recommended security headers for nginx and Caddy are in [SECURITY_HEADERS_GUIDE.md](SECURITY_HEADERS_GUIDE.md).
The guide is in Bulgarian, but the config blocks can be used as they are.

**Update to a new version:**

```sh
git pull
docker compose up -d --build
```

> `VITE_*` values are baked into the app at **build** time. After changing `.env`, rebuild.

## 3. Make yourself an administrator

Sign up in the app. Then open [`database/make-admin.sql`](database/make-admin.sql), put your e-mail in it and run it in the SQL Editor.
Administrators get:
- the `/admin` page for user management
- the e-mail settings

---

## Optional features

### E-mail reminders and reports (Python backend)

The backend sends three kinds of e-mail:
- reminders, checked every 5 minutes
- overdue-task alerts, daily at 08:00
- the weekly report, at 08:05 on the configured day

The schedule uses `Europe/Sofia` time, set in `backend/server.py`.

1. **In the app**, as an administrator, open **Settings** and find the **„Email Gateway настройки"** card. Set the gateway URL, the API key and the sender.
   The gateway receives
   `POST <EMAIL_GATEWAY_URL>` with the header `Authorization: Bearer <EMAIL_GATEWAY_API_KEY>` and a JSON body
   `{ "from", "to": [..], "subject", "html", "reply_to"? }`.
   This is the same format as the [Resend](https://resend.com) API (`https://api.resend.com/emails`).
   Any service or relay that accepts it will work.
2. **Start the backend:**

   ```sh
   cd backend
   python -m venv venv
   . venv/bin/activate              # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env             # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   uvicorn server:app --host 127.0.0.1 --port 8001
   curl http://127.0.0.1:8001/api/scheduler-status
   ```

   Keep it running with systemd, pm2, Docker or similar.
   The `service_role` key bypasses the security policies. Keep it on the server and **never** put it in the frontend.

### Edge Functions

Some features call Supabase Edge Functions from [`frontend/supabase/functions`](frontend/supabase/functions):

| Function | Needed for |
|---|---|
| `delete-user`, `update-user-role` | the `/admin` page |
| `send-test-email` | the "test e-mail" button in the e-mail settings |
| `process-notifications` | e-mails to members of shared projects about new tasks and notes |
| `ai-soniox-token` | voice notes |
| `n8n-webhook` | the n8n integration (**Settings → „n8n Интеграция"**) |
| `process-reminders`, `check-overdue-tasks` | the same job as the Python backend. **Not needed** if you run the backend |

Deploy them to supabase.com with the Supabase CLI:

```sh
cd frontend
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy
# only for n8n and voice notes:
npx supabase secrets set N8N_WEBHOOK_SECRET=<random-string> N8N_ALLOWED_ORIGIN=https://your-domain
```

On supabase.com, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are available to functions automatically.
On self-hosted Supabase, copy the function folders into your Edge Functions volume, as described in the Supabase self-hosting docs.

### Voice notes

Each user enters their own [Soniox](https://soniox.com) API key in **Settings → „AI и гласови настройки"**.
The browser can save the key but can never read it back: it is stored in the `user_ai_secrets` table.
This feature requires the `ai-soniox-token` function.

### Workout tracker (`/sport`)

It is off by default. Each user can switch it on in **Settings → „Спорт"**.

### Self-hosted Supabase that only accepts your production domain

In local development, requests can go through the Vite dev server instead.
See the commented lines at the end of [`frontend/.env.example`](frontend/.env.example).

---

## Development

```sh
cd frontend
npm run check                # types + tests + build (+ lint report)
cd ../backend
python -m pytest -q          # backend tests
```

```
frontend/                         React 18 + Vite + TypeScript + Tailwind + shadcn/ui
  src/integrations/supabase/      Supabase client and generated database types
  supabase/migrations/            database schema history (Supabase CLI format)
  supabase/functions/             Edge Functions (Deno)
sql_migrations/                   later schema additions, applied after migrations/
database/install.sql              all of the above in one file, in order
database/make-admin.sql           grants the admin role to a user
backend/                          optional FastAPI + APScheduler e-mail jobs
Dockerfile, docker-compose.yml    production container for the frontend (nginx)
```

To change the schema:
1. Add a new dated `.sql` file to `sql_migrations/`.
2. Append the same file to `database/install.sql`. That file contains `frontend/supabase/migrations/*` and then `sql_migrations/*`, each in file-name order.

## License

[MIT](LICENSE). You may use, change and share the code freely, including for commercial use.
