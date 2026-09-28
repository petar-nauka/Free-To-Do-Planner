"""
Email service — handles ALL email logic directly in Python.
No Edge Functions needed. Works with any Supabase (cloud or self-hosted).

Requires in backend/.env:
  SUPABASE_URL          = https://your-supabase.example.com
  SUPABASE_SERVICE_ROLE_KEY = eyJ...   (bypasses RLS — reads all users' data)
  SUPABASE_ANON_KEY     = eyJ...       (fallback, limited access)
"""
import os
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from html import escape as html_escape

import httpx

logger = logging.getLogger(__name__)


# ── Security helpers ────────────────────────────────────────────────────────

# CRLF / control characters used in email header injection attacks.
# Strips newlines, carriage returns, NULL bytes, and other control chars.
_HEADER_INJECTION_RE = re.compile(r'[\r\n\x00-\x1f\x7f]')


def _safe_header(text: str, max_len: int = 200) -> str:
    """
    Sanitize text for use in email headers (Subject, From, To).
    Removes CRLF and other characters used for header injection attacks.
    Truncates to max_len chars.
    """
    if not text:
        return ""
    cleaned = _HEADER_INJECTION_RE.sub(' ', str(text)).strip()
    return cleaned[:max_len]


def _safe_html(text: str) -> str:
    """HTML-escape user-controlled text before interpolating into email HTML."""
    if not text:
        return ""
    return html_escape(str(text), quote=True)


def _safe_email(addr: str) -> str:
    """
    Validate and sanitize email address. Returns empty string if invalid.
    Prevents header injection and rejects obviously malformed addresses.
    """
    if not addr:
        return ""
    cleaned = _HEADER_INJECTION_RE.sub('', str(addr)).strip()
    # Basic email shape check (RFC 5322 simplified)
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', cleaned):
        return ""
    return cleaned[:254]  # RFC 5321 max length


def _supabase_url() -> str:
    return os.environ.get("SUPABASE_URL", "").rstrip("/")


def _key() -> str:
    """Service role key bypasses RLS. Falls back to anon key."""
    k = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_ANON_KEY", "")
    if not k:
        logger.warning("No Supabase key configured!")
    return k


def _headers() -> dict:
    k = _key()
    return {
        "apikey": k,
        "Authorization": f"Bearer {k}",
        "Content-Type": "application/json",
    }


async def _get(table: str, params: dict) -> list[dict]:
    """GET from Supabase REST API."""
    url_base = _supabase_url()
    if not url_base:
        return []
    url = f"{url_base}/rest/v1/{table}"
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(url, headers=_headers(), params=params)
        if r.status_code == 200:
            return r.json() or []
        logger.error(f"GET {table} → {r.status_code}: {r.text[:300]}")
        return []
    except Exception as e:
        logger.error(f"GET {table} exception: {e}")
        return []


async def _patch(table: str, eq: dict, payload: dict) -> bool:
    """PATCH (update) rows in Supabase REST API."""
    url_base = _supabase_url()
    if not url_base:
        return False
    url = f"{url_base}/rest/v1/{table}"
    params = {k: f"eq.{v}" for k, v in eq.items()}
    hdrs = {**_headers(), "Prefer": "return=minimal"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.patch(url, headers=hdrs, params=params, json=payload)
        if r.status_code in (200, 204):
            return True
        logger.error(f"PATCH {table} → {r.status_code}: {r.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"PATCH {table} exception: {e}")
        return False


async def _get_settings() -> dict[str, str]:
    rows = await _get("app_settings", {"select": "key,value"})
    return {r["key"]: r.get("value") or "" for r in rows}


async def _send_email(
    gateway_url: str,
    api_key: str,
    from_str: str,
    to: str | list,
    subject: str,
    html: str,
    reply_to: str = "",
) -> bool:
    """Send email via configured gateway. Sanitizes all header fields."""
    # Sanitize headers — prevent CRLF injection attacks
    safe_subject = _safe_header(subject, max_len=200)
    safe_from = _safe_header(from_str, max_len=200)
    safe_reply_to = _safe_email(reply_to) if reply_to else ""

    # Validate recipient(s)
    if isinstance(to, str):
        to_list = [_safe_email(to)]
    else:
        to_list = [_safe_email(t) for t in to if t]
    to_list = [t for t in to_list if t]  # drop invalid

    if not to_list:
        logger.error("Email aborted: no valid recipient")
        return False

    payload: dict[str, Any] = {
        "from": safe_from,
        "to": to_list,
        "subject": safe_subject,
        "html": html,
    }
    if safe_reply_to:
        payload["reply_to"] = safe_reply_to
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                gateway_url,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                json=payload,
            )
        if r.status_code < 300:
            return True
        logger.error(f"Email gateway {r.status_code}: {r.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"Email gateway exception: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# REMINDERS + RECURRING TASKS
# ─────────────────────────────────────────────────────────────────────────────

async def process_reminders() -> dict:
    """
    Main job — called every 5 minutes by the scheduler.
    Sends due reminders and recurring task notifications.
    """
    if not _supabase_url():
        logger.warning("[reminders] SUPABASE_URL not set — skipping")
        return {"reminders": 0, "recurring": 0}

    settings = await _get_settings()

    if settings.get("email_notifications_enabled", "true") != "true":
        logger.info("[reminders] Email notifications disabled")
        return {"reminders": 0, "recurring": 0}

    gateway_url = settings.get("EMAIL_GATEWAY_URL", "")
    api_key     = settings.get("EMAIL_GATEWAY_API_KEY", "")
    from_name   = settings.get("email_from_name") or "TaskFlow"
    from_addr   = settings.get("email_from_address") or "noreply@example.com"
    reply_to    = settings.get("email_reply_to", "")
    from_str    = f"{from_name} <{from_addr}>"

    if not gateway_url or not api_key:
        logger.warning("[reminders] Email gateway not configured")
        return {"reminders": 0, "recurring": 0}

    now_iso = datetime.now(timezone.utc).isoformat()
    sent_reminders = 0
    sent_recurring = 0

    # ── 1. Pending reminders ────────────────────────────────────────────────
    reminders = await _get("reminders", {
        "select": "id,title,description,reminder_date,reminder_email,project_id",
        "is_sent": "eq.false",
        "reminder_date": f"lte.{now_iso}",
    })

    logger.info(f"[reminders] Found {len(reminders)} pending reminder(s)")

    for rem in reminders:
        # Project name
        projects = await _get("projects", {"select": "name", "id": f"eq.{rem.get('project_id','')}"})
        project_name = projects[0]["name"] if projects else "N/A"

        # Escape ALL user-controlled content before interpolating into HTML
        safe_title = _safe_html(rem.get('title', ''))
        safe_desc = _safe_html(rem.get('description', ''))
        safe_project = _safe_html(project_name)

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px;border-radius:12px;margin-bottom:20px;">
            <h2 style="color:white;margin:0;">🔔 Напомняне: {safe_title}</h2>
          </div>
          {f'<p style="color:#374151;">{safe_desc}</p>' if safe_desc else ""}
          <div style="background:#f3f4f6;padding:15px;border-radius:8px;margin:20px 0;">
            <p style="margin:0;color:#6b7280;">
              <strong>Проект:</strong> {safe_project}<br/>
              <strong>Планирано за:</strong> {datetime.fromisoformat(rem['reminder_date'].replace('Z','+00:00')).strftime('%d.%m.%Y %H:%M') if rem.get('reminder_date') else '—'}
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">Автоматично напомняне от TaskFlow</p>
        </div>"""

        ok = await _send_email(
            gateway_url, api_key, from_str,
            rem.get("reminder_email", ""),
            f"🔔 Напомняне: {rem.get('title','')}",
            html, reply_to,
        )
        if ok:
            await _patch("reminders", {"id": rem["id"]}, {"is_sent": True, "sent_at": now_iso})
            sent_reminders += 1
            logger.info(f"[reminders] Sent reminder {rem['id']}")
        else:
            logger.error(f"[reminders] Failed to send reminder {rem['id']}")

    # ── 2. Recurring tasks ──────────────────────────────────────────────────
    recurring = await _get("recurring_tasks", {
        "select": "id,title,description,recurrence_type,time_of_day,day_of_month,notification_email,project_id",
        "is_active": "eq.true",
        "next_run_at": f"lte.{now_iso}",
    })

    logger.info(f"[recurring] Found {len(recurring)} pending recurring task(s)")

    recurrence_label = {
        "daily": "Ежедневно",
        "weekly": "Ежеседмично",
        "monthly": "Ежемесечно",
    }

    for task in recurring:
        projects = await _get("projects", {"select": "name", "id": f"eq.{task.get('project_id','')}"})
        project_name = projects[0]["name"] if projects else "N/A"
        r_type = task.get("recurrence_type", "daily")

        safe_title = _safe_html(task.get('title', ''))
        safe_desc = _safe_html(task.get('description', ''))
        safe_project = _safe_html(project_name)
        safe_time = _safe_html(task.get('time_of_day', '—'))

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:linear-gradient(135deg,#10b981,#059669);padding:20px;border-radius:12px;margin-bottom:20px;">
            <h2 style="color:white;margin:0;">🔄 Повтаряща се задача: {safe_title}</h2>
          </div>
          {f'<p style="color:#374151;">{safe_desc}</p>' if safe_desc else ""}
          <div style="background:#f3f4f6;padding:15px;border-radius:8px;margin:20px 0;">
            <p style="margin:0;color:#6b7280;">
              <strong>Проект:</strong> {safe_project}<br/>
              <strong>Тип:</strong> {recurrence_label.get(r_type, r_type)}<br/>
              <strong>Час:</strong> {safe_time}
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">Автоматично известие от TaskFlow</p>
        </div>"""

        ok = await _send_email(
            gateway_url, api_key, from_str,
            task.get("notification_email", ""),
            f"🔄 {task.get('title','')}",
            html, reply_to,
        )
        if ok:
            # Calculate next run
            now_local = datetime.now(timezone.utc)
            try:
                h, m = [int(x) for x in (task.get("time_of_day") or "08:00").split(":")]
            except Exception:
                h, m = 8, 0

            next_run = now_local.replace(hour=h, minute=m, second=0, microsecond=0)
            if r_type == "daily":
                next_run += timedelta(days=1)
            elif r_type == "weekly":
                next_run += timedelta(weeks=1)
            elif r_type == "monthly":
                month = next_run.month + 1
                year = next_run.year + (1 if month > 12 else 0)
                month = month if month <= 12 else 1
                day = task.get("day_of_month") or next_run.day
                try:
                    next_run = next_run.replace(year=year, month=month, day=day)
                except ValueError:
                    next_run = next_run.replace(year=year, month=month, day=28)

            await _patch("recurring_tasks", {"id": task["id"]}, {
                "last_run_at": now_iso,
                "next_run_at": next_run.isoformat(),
            })
            sent_recurring += 1
            logger.info(f"[recurring] Sent task {task['id']}, next run: {next_run.isoformat()}")
        else:
            logger.error(f"[recurring] Failed to send task {task['id']}")

    return {"reminders": sent_reminders, "recurring": sent_recurring}


# ─────────────────────────────────────────────────────────────────────────────
# OVERDUE TASKS
# ─────────────────────────────────────────────────────────────────────────────

async def process_overdue_tasks() -> dict:
    """Check for overdue tasks and send notifications. Called daily."""
    if not _supabase_url():
        return {"processed": 0}

    settings = await _get_settings()

    if settings.get("email_notifications_enabled", "true") != "true":
        return {"processed": 0}
    if settings.get("overdue_notifications_enabled", "true") != "true":
        return {"processed": 0}

    overdue_days = int(settings.get("overdue_task_days") or "7")
    gateway_url  = settings.get("EMAIL_GATEWAY_URL", "")
    api_key      = settings.get("EMAIL_GATEWAY_API_KEY", "")
    from_name    = settings.get("email_from_name") or "TaskFlow"
    from_addr    = settings.get("email_from_address") or "noreply@example.com"
    reply_to     = settings.get("email_reply_to", "")
    from_str     = f"{from_name} <{from_addr}>"

    if not gateway_url or not api_key:
        return {"processed": 0}

    cutoff = (datetime.now(timezone.utc) - timedelta(days=overdue_days)).date().isoformat()

    tasks = await _get("tasks", {
        "select": "id,title,due_date,priority,project_id,user_id",
        "due_date": f"lte.{cutoff}",
        "archived_at": "is.null",
        "overdue_notified_at": "is.null",
    })

    if not tasks:
        logger.info("[overdue] No overdue tasks found")
        return {"processed": 0}

    # Group by user_id
    by_user: dict[str, list] = {}
    for t in tasks:
        uid = t.get("user_id", "")
        by_user.setdefault(uid, []).append(t)

    # Fetch projects + profiles
    all_project_ids = list({t["project_id"] for t in tasks})
    projects_rows = await _get("projects", {"select": "id,name", "id": f"in.({','.join(all_project_ids)})"})
    project_map = {p["id"]: p["name"] for p in projects_rows}

    all_user_ids = list(by_user.keys())
    profiles = await _get("profiles", {"select": "user_id,email,display_name", "user_id": f"in.({','.join(all_user_ids)})"})
    profile_map = {p["user_id"]: p for p in profiles}

    now_iso = datetime.now(timezone.utc).isoformat()
    notified_ids: list[str] = []
    sent = 0

    priority_label = {"high": "🔴 Висок", "medium": "🟡 Среден", "low": "🟢 Нисък"}

    for uid, user_tasks in by_user.items():
        profile = profile_map.get(uid, {})
        email = profile.get("email", "")
        name  = profile.get("display_name") or email or "Потребител"
        if not email:
            continue

        rows_html = "".join(
            f"""<tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:8px 6px;font-size:13px;">{_safe_html(t.get('title',''))}</td>
              <td style="padding:8px 6px;font-size:12px;color:#6b7280;">{_safe_html(project_map.get(t.get('project_id',''),'—'))}</td>
              <td style="padding:8px 6px;font-size:12px;">{priority_label.get(t.get('priority','low'),'')}</td>
              <td style="padding:8px 6px;font-size:12px;color:#ef4444;">{_safe_html((t.get('due_date') or '')[:10])}</td>
            </tr>"""
            for t in user_tasks
        )

        safe_name = _safe_html(name)
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
          <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px;border-radius:12px;margin-bottom:20px;">
            <h1 style="color:white;margin:0;font-size:20px;">⚠️ Просрочени задачи</h1>
            <p style="color:rgba(255,255,255,.8);margin:6px 0 0;">Здравейте, {safe_name}!</p>
          </div>
          <p style="color:#374151;">Имате <strong>{len(user_tasks)}</strong> задач{'а' if len(user_tasks)==1 else 'и'} просрочен{'а' if len(user_tasks)==1 else 'и'} с повече от <strong>{overdue_days} дни</strong>.</p>
          <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ЗАДАЧА</th>
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ПРОЕКТ</th>
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ПРИОРИТЕТ</th>
              <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">КРАЕН СРОК</th>
            </tr></thead>
            <tbody>{rows_html}</tbody>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:11px;">Автоматично известие от TaskFlow · {datetime.now().strftime('%d.%m.%Y')}</p>
        </div>"""

        ok = await _send_email(gateway_url, api_key, from_str, email,
                               f"⚠️ {len(user_tasks)} просрочен{'а задача' if len(user_tasks)==1 else 'и задачи'}", html, reply_to)
        if ok:
            notified_ids.extend(t["id"] for t in user_tasks)
            sent += 1

    # Mark as notified
    if notified_ids:
        # Patch in batches of 50
        for i in range(0, len(notified_ids), 50):
            batch = notified_ids[i:i+50]
            await _patch("tasks", {"id": f"in.({','.join(batch)})"}, {"overdue_notified_at": now_iso})

    logger.info(f"[overdue] Notified {sent} users about {len(notified_ids)} tasks")
    return {"processed": sent}


# ─────────────────────────────────────────────────────────────────────────────
# WEEKLY REPORT
# ─────────────────────────────────────────────────────────────────────────────

def _fmt_seconds(sec: int) -> str:
    if not sec or sec < 0:
        return "—"
    h, rem = divmod(sec, 3600)
    m = rem // 60
    return f"{h}ч {m}м" if h else f"{m}м"


async def run_weekly_report() -> None:
    """Send weekly summary emails. Called daily — checks configured day internally."""
    if not _supabase_url():
        logger.warning("[weekly-report] SUPABASE_URL not set")
        return

    settings = await _get_settings()

    if settings.get("weekly_report_enabled", "true") != "true":
        logger.info("[weekly-report] Disabled")
        return
    if settings.get("email_notifications_enabled", "true") != "true":
        return

    gateway_url = settings.get("EMAIL_GATEWAY_URL", "")
    api_key     = settings.get("EMAIL_GATEWAY_API_KEY", "")
    from_name   = settings.get("email_from_name") or "TaskFlow"
    from_addr   = settings.get("email_from_address") or "noreply@example.com"
    reply_to    = settings.get("email_reply_to", "")
    from_str    = f"{from_name} <{from_addr}>"

    if not gateway_url or not api_key:
        logger.warning("[weekly-report] Gateway not configured")
        return

    configured_day = int(settings.get("weekly_report_day") or "1")
    today_dow = datetime.now().weekday()  # 0=Mon … 6=Sun
    if today_dow != configured_day:
        logger.info(f"[weekly-report] Today={today_dow}, configured={configured_day} — skipping")
        return

    now = datetime.now(timezone.utc)
    week_ago    = (now - timedelta(days=7)).isoformat()
    next_week   = (now + timedelta(days=7)).date().isoformat()
    today_str   = now.date().isoformat()
    report_date = now.strftime("%d.%m.%Y")

    profiles = await _get("profiles", {"select": "user_id,email,display_name"})
    if not profiles:
        return

    projects = await _get("projects", {"select": "id,name,user_id", "archived_at": "is.null"})
    project_map = {p["id"]: p["name"] for p in projects}

    tasks = await _get("tasks", {
        "select": "id,title,due_date,priority,status,archived_at,project_id,user_id,total_time_seconds"
    })

    time_entries = await _get("time_entries", {
        "select": "user_id,duration_seconds",
        "stopped_at": "not.is.null",
        "started_at": f"gte.{week_ago}",
    })

    sent_count = 0

    for profile in profiles:
        uid   = profile.get("user_id")
        email = profile.get("email", "")
        name  = profile.get("display_name") or email or "Потребител"
        if not email:
            continue

        user_proj_ids = {p["id"] for p in projects if p.get("user_id") == uid}
        if not user_proj_ids:
            continue

        user_tasks = [t for t in tasks if t.get("project_id") in user_proj_ids]
        if not user_tasks:
            continue

        completed = [t for t in user_tasks
                     if t.get("archived_at") and t["archived_at"] >= week_ago]
        overdue   = [t for t in user_tasks
                     if not t.get("archived_at") and t.get("due_date") and t["due_date"][:10] < today_str]
        upcoming  = [t for t in user_tasks
                     if not t.get("archived_at") and t.get("due_date")
                     and today_str <= t["due_date"][:10] <= next_week]

        weekly_sec = sum(e.get("duration_seconds") or 0
                         for e in time_entries if e.get("user_id") == uid)

        if not completed and not overdue and not upcoming and not weekly_sec:
            continue

        def _tbl(task_list: list) -> str:
            if not task_list:
                return '<tr><td colspan="3" style="padding:10px;color:#9ca3af;text-align:center;">Няма задачи</td></tr>'
            return "".join(
                f"""<tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:8px 6px;font-size:13px;">{_safe_html(t.get('title',''))}</td>
                  <td style="padding:8px 6px;font-size:12px;color:#6b7280;">{_safe_html(project_map.get(t.get('project_id',''),'—'))}</td>
                  <td style="padding:8px 6px;font-size:12px;">{_safe_html((t.get('due_date') or '')[:10])}</td>
                </tr>"""
                for t in task_list
            )

        def _section(title: str, icon: str, color: str, tlist: list) -> str:
            return f"""
            <div style="margin-bottom:24px;">
              <h2 style="margin:0 0 10px;font-size:15px;color:{color};">{icon} {title}</h2>
              <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
                <thead><tr style="background:#f3f4f6;">
                  <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ЗАДАЧА</th>
                  <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">ПРОЕКТ</th>
                  <th style="padding:8px 6px;text-align:left;font-size:11px;color:#6b7280;">КРАЕН СРОК</th>
                </tr></thead>
                <tbody>{_tbl(tlist)}</tbody>
              </table>
            </div>"""

        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#fff;">
          <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px;border-radius:12px;margin-bottom:24px;">
            <h1 style="color:white;margin:0;font-size:20px;">📈 Седмичен отчет</h1>
            <p style="color:rgba(255,255,255,.7);margin:6px 0 0;">Здравейте, {_safe_html(name)}! · {report_date}</p>
          </div>
          <div style="background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;gap:32px;">
            <div><div style="color:rgba(255,255,255,.7);font-size:12px;">Изхарчено време</div>
              <div style="color:white;font-size:26px;font-weight:700;">{_fmt_seconds(weekly_sec)}</div></div>
            <div><div style="color:rgba(255,255,255,.7);font-size:12px;">Завършени задачи</div>
              <div style="color:white;font-size:26px;font-weight:700;">{len(completed)}</div></div>
          </div>
          {_section('Завършени тази седмица', '✅', '#059669', completed[:15])}
          {_section('Предстоящи дедлайни (7 дни)', '📅', '#2563eb', upcoming[:15])}
          {_section('Просрочени задачи', '⚠️', '#dc2626', overdue[:15])}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:11px;">Автоматичен отчет от TaskFlow · {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
        </div>"""

        subj = f"📈 Седмичен отчет — {len(completed)} завършени, {len(overdue)} просрочени"
        ok = await _send_email(gateway_url, api_key, from_str, email, subj, html, reply_to)
        if ok:
            sent_count += 1
            logger.info(f"[weekly-report] Sent to {email}")
        else:
            logger.error(f"[weekly-report] Failed for {email}")

    logger.info(f"[weekly-report] Done — {sent_count}/{len(profiles)} sent")
