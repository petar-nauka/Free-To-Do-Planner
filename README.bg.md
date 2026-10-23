# Free To-Do Planner (Supabase)

🇬🇧 [Read in English](README.md)

Безплатен планер за **проекти, задачи, бележки и таблици**, който хостваш сам. Направен е с React и Supabase.
Можеш да го пуснеш на свой компютър или сървър, а данните остават в **твоята собствена** Supabase база.

> **Език на интерфейса:** български. За част от интерфейса има и английски превод (i18next).

## Възможности

- Проекти с Kanban дъски: drag & drop, тагове, коментари, прикачени файлове, цветове на задачите като в Google Keep с филтър по цвят
- Приоритетни задачи, „План за днес“, повтарящи се задачи, напомняния, календар
- Бележки с история на версиите и кошче
- Таблици с формули
- Бели дъски за рисуване и скици (Excalidraw)
- Отчитане на време, глобално търсене, постоянни линкове към проекти, бележки и задачи
- Споделени проекти: канене на други потребители по имейл
- Напомняния, известия за просрочени задачи и седмичен отчет по имейл (незадължителен backend)
- Седмичен имейл за задачи, непипани 30+ дни, с ключ за всеки потребител и за всеки проект
- Незадължително: гласови бележки с разпознаване на реч (Soniox), интеграция с n8n, дневник за тренировки
- Удобно за телефон и се инсталира като приложение (PWA)

## Как работи

```
Браузър (React приложение) ─────► Supabase: Postgres + Auth + Storage
                                      ▲   (правилата за достъп се спазват в самата
Python backend (незадължителен) ──────┘    база чрез Row-Level Security политики)
(праща имейли по график)
```

Frontend-ът говори директно със Supabase. За основното приложение не ти трябва отделен сървър с логика.
Сервират се само статични файлове.

## Изисквания

- **Node.js 20+** (препоръчително 22) и npm
- **Supabase** проект: безплатният план на [supabase.com](https://supabase.com) или [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting)
- За сървър: **Docker** с Compose
- За имейлите (незадължително): **Python 3.12**

---

## 1. Създай базата (веднъж)

1. Създай **нов, празен** Supabase проект.
2. Отвори **SQL Editor**, постави цялото съдържание на [`database/install.sql`](database/install.sql) и натисни **Run**.
   Така се създават и 24-те таблици, политиките за сигурност, функциите, тригерите и хранилището за файлове `attachments`.
   Пусни го **само веднъж**, върху празен проект.
3. **Authentication → URL Configuration:** в **Site URL** сложи адреса на приложението:
   `http://localhost:3000` локално или `https://твоят-домейн` на сървър.
   Натам водят линковете в имейлите за потвърждение на регистрация.
   *За бърз локален тест* можеш да изключиш **Confirm email** в Authentication → Providers → Email.
4. **Project Settings → API:** копирай **Project URL** и **anon / publishable key**.

## 2а. Локално на компютъра

```sh
git clone https://github.com/petar-nauka/Free-To-Do-Planner.git
cd Free-To-Do-Planner/frontend
cp .env.example .env        # Windows: copy .env.example .env
# попълни в .env: VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY
npm ci
npm run dev                 # → http://localhost:3000
```

## 2б. На сървър (Docker)

```sh
git clone https://github.com/petar-nauka/Free-To-Do-Planner.git
cd Free-To-Do-Planner
cp .env.example .env        # попълни двете VITE_ стойности
docker compose up -d --build
curl -I http://127.0.0.1:8100   # очаквано: HTTP/1.1 200 OK
```

Контейнерът слуша само на `127.0.0.1:8100`. Пред него сложи reverse proxy с HTTPS.
Най-кратко става с [Caddy](https://caddyserver.com), защото той сам взима сертификата:

```
todo.example.com {
    reverse_proxy 127.0.0.1:8100
}
```

Препоръчителните security headers за nginx и Caddy са в [SECURITY_HEADERS_GUIDE.md](SECURITY_HEADERS_GUIDE.md).

**Обновяване до нова версия:**

```sh
git pull
docker compose up -d --build
```

> Стойностите `VITE_*` се вграждат в приложението при **build**. След промяна в `.env` build-ни наново.

## 3. Направи се администратор

Регистрирай се в приложението. После отвори [`database/make-admin.sql`](database/make-admin.sql), сложи своя имейл и го пусни в SQL Editor.
Администраторът вижда:
- страницата `/admin` за управление на потребители
- имейл настройките

---

## Незадължителни функции

### Напомняния и отчети по имейл (Python backend)

Backend-ът праща три вида имейли:
- напомняния, проверява на всеки 5 минути
- известия за просрочени задачи, всеки ден в 08:00
- седмичния отчет, в 08:05 в избрания ден

Часовете са по `Europe/Sofia`, зададено в `backend/server.py`.

1. **В приложението**, като администратор, отвори **Настройки** → картата **„Email Gateway настройки“**. Попълни адреса на gateway-я, API ключа и подателя.
   Gateway-ят получава
   `POST <EMAIL_GATEWAY_URL>` с хедър `Authorization: Bearer <EMAIL_GATEWAY_API_KEY>` и JSON
   `{ "from", "to": [..], "subject", "html", "reply_to"? }`.
   Това е същият формат като API-то на [Resend](https://resend.com) (`https://api.resend.com/emails`).
   Работи с всяка услуга или relay, която приема този формат.
2. **Пусни backend-а:**

   ```sh
   cd backend
   python -m venv venv
   . venv/bin/activate              # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env             # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   uvicorn server:app --host 127.0.0.1 --port 8001
   curl http://127.0.0.1:8001/api/scheduler-status
   ```

   За постоянна работа използвай systemd, pm2, Docker или подобно.
   Ключът `service_role` заобикаля политиките за сигурност. Пази го само на сървъра и **никога** не го слагай във frontend-а.

### Edge Functions

Някои функции викат Supabase Edge Functions от [`frontend/supabase/functions`](frontend/supabase/functions):

| Функция | Нужна за |
|---|---|
| `delete-user`, `update-user-role` | страницата `/admin` |
| `send-test-email` | бутона за тестов имейл в имейл настройките |
| `process-notifications` | имейли до членовете на споделени проекти за нови задачи и бележки |
| `ai-soniox-token` | гласовите бележки |
| `n8n-webhook` | интеграцията с n8n (**Настройки → „n8n Интеграция“**) |
| `stale-tasks-digest` | седмичния имейл за непипани задачи (трябва да се пусне по график — виж по-долу) |
| `process-reminders`, `check-overdue-tasks` | вършат същото като Python backend-а. **Не са нужни**, ако пуснеш backend-а |

Качват се в supabase.com със Supabase CLI:

```sh
cd frontend
npx supabase login
npx supabase link --project-ref <project-ref-на-проекта>
npx supabase functions deploy
# само за n8n и гласовите бележки:
npx supabase secrets set N8N_WEBHOOK_SECRET=<случаен-низ> N8N_ALLOWED_ORIGIN=https://твоят-домейн
```

В supabase.com функциите получават `SUPABASE_URL`, `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` автоматично.
При self-hosted Supabase копирай папките на функциите в volume-а за Edge Functions, както е описано в документацията на Supabase за self-hosting.

#### Седмичен имейл за непипани задачи (`stale-tasks-digest`)

Всеки понеделник всеки потребител получава едно писмо със своите задачи, които никой не е променял 30+ дни. Спира се от
**Настройки**, а за отделен проект — от редакцията на проекта (от собственика). Функцията се пуска само със `service_role` ключа.
Пусни я веднъж седмично, например с cron на собствен сървър:

```sh
0 8 * * 1  curl -s -X POST http://localhost:8000/functions/v1/stale-tasks-digest -H "Authorization: Bearer <service_role ключ>" -d "{}"
```

В supabase.com ползвай **Integrations → Cron** със същата заявка. С тяло `{"dry_run": true}` виждаш на кого какво би пратила, без да праща.
Праща `{to, subject, html, from, fromName}` към `EMAIL_GATEWAY_URL` със заглавка `X-Api-Key: <EMAIL_GATEWAY_API_KEY>`,
а линкове слага, когато редът `app_url` в `app_settings` съдържа адреса на сайта ти.

### Гласови бележки

Всеки потребител въвежда собствен [Soniox](https://soniox.com) API ключ в **Настройки → „AI и гласови настройки“**.
Браузърът може да запише ключа, но не може да го прочете обратно: той се пази в таблицата `user_ai_secrets`.
Нужна е функцията `ai-soniox-token`.

### Дневник за тренировки (`/sport`)

По подразбиране е изключен. Всеки потребител може да го включи от **Настройки → „Спорт“**.

### Self-hosted Supabase, който приема само production домейна

При локална разработка заявките могат да минават през dev сървъра на Vite.
Виж коментираните редове в края на [`frontend/.env.example`](frontend/.env.example).

---

## Разработка

```sh
cd frontend
npm run check                # типове + тестове + build (+ lint отчет)
cd ../backend
python -m pytest -q          # тестове на backend-а
```

```
frontend/                         React 18 + Vite + TypeScript + Tailwind + shadcn/ui
  src/integrations/supabase/      Supabase клиент и генерирани типове на базата
  supabase/migrations/            история на схемата (формат на Supabase CLI)
  supabase/functions/             Edge Functions (Deno)
sql_migrations/                   по-късни добавки към схемата, след migrations/
database/install.sql              всичко горе в един файл, в правилния ред
database/make-admin.sql           дава администраторска роля на потребител
backend/                          незадължителни имейл задачи (FastAPI + APScheduler)
Dockerfile, docker-compose.yml    production контейнер за frontend-а (nginx)
```

За промяна на схемата:
1. Добави нов `.sql` файл с дата в `sql_migrations/`.
2. Добави същия файл и в края на `database/install.sql`. Там са `frontend/supabase/migrations/*` и после `sql_migrations/*`, всяка папка по ред на имената.

## Лиценз

[MIT](LICENSE). Можеш свободно да използваш, променяш и споделяш кода, включително с търговска цел.
