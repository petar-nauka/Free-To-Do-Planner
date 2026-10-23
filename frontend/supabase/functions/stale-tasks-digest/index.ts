import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildDigests, digestSubject, isoWeek, renderDigestHtml, STALE_DAYS,
  type DigestMember, type DigestProfile, type DigestProject, type DigestTask,
} from "./digest.ts";

/**
 * Седмично писмо за задачи, непипани 30+ дни (логиката е в digest.ts).
 * Пуска го cron на сървъра, в понеделник 08:00 (сървърът е на часа на София):
 *   0 8 * * 1  curl -s -X POST http://localhost:8003/functions/v1/stale-tasks-digest \
 *              -H "Authorization: Bearer <service_role ключ>" -d '{}'
 * Тяло по желание:
 *   {"dry_run": true}        — само казва на кого колко задачи би пратило;
 *   {"only_email": "a@b.c"}  — праща само на този адрес (проба), без да отбелязва седмицата.
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

serve(async (req: Request): Promise<Response> => {
  // На self-hosted входът не проверява JWT (VERIFY_JWT=false), затова тук пускаме
  // само извикване със service_role ключа — тоест само cron-а на сървъра.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const onlyEmail = typeof body?.only_email === "string" ? body.only_email.toLowerCase() : null;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data: settingRows, error: settingsError } = await supabase.from("app_settings").select("key,value");
  if (settingsError) return json({ error: settingsError.message }, 500);
  const settings: Record<string, string> = Object.fromEntries(
    (settingRows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? ""]),
  );

  if (settings.email_notifications_enabled === "false") return json({ skipped: "email notifications disabled" });

  const now = new Date();
  const week = isoWeek(now);
  const marksWeek = !dryRun && !onlyEmail;
  if (marksWeek && settings.stale_tasks_last_sent_week === week) {
    return json({ skipped: "already sent this week", week });
  }

  const cutoff = new Date(now.getTime() - STALE_DAYS * 86400000).toISOString();
  const [tasksRes, projectsRes, membersRes, profilesRes] = await Promise.all([
    supabase.from("tasks")
      .select("id,title,priority,project_id,user_id,updated_at,created_at,archived_at")
      .is("archived_at", null)
      .lt("updated_at", cutoff),
    supabase.from("projects").select("id,name,user_id,stale_tasks_email").is("archived_at", null),
    supabase.from("project_members").select("project_id,user_id").eq("status", "accepted"),
    supabase.from("profiles").select("user_id,email,display_name,stale_tasks_email"),
  ]);
  const failedQuery = [tasksRes, projectsRes, membersRes, profilesRes].find((r) => r.error);
  if (failedQuery?.error) return json({ error: failedQuery.error.message }, 500);

  let digests = buildDigests(
    tasksRes.data as DigestTask[],
    projectsRes.data as DigestProject[],
    membersRes.data as DigestMember[],
    profilesRes.data as DigestProfile[],
    now,
  );
  if (onlyEmail) digests = digests.filter((d) => d.email.toLowerCase() === onlyEmail);

  if (dryRun) {
    return json({ week, dry_run: true, recipients: digests.map((d) => ({ email: d.email, tasks: d.items.length })) });
  }

  const gatewayUrl = settings.EMAIL_GATEWAY_URL;
  const apiKey = settings.EMAIL_GATEWAY_API_KEY;
  if (!gatewayUrl || !apiKey) return json({ error: "email gateway not configured" }, 500);

  let sent = 0;
  const errors: string[] = [];
  for (const digest of digests) {
    try {
      // Същият договор с пощенския шлюз като работещите напомняния (process-scheduled).
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({
          to: digest.email,
          subject: digestSubject(digest.items.length),
          html: renderDigestHtml(digest, settings.app_url ?? ""),
          from: settings.email_from_address,
          fromName: settings.email_from_name,
        }),
      });
      if (res.ok) sent++;
      else errors.push(`${digest.email}: HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${digest.email}: ${(e as Error).message}`);
    }
  }

  // Отбелязваме седмицата и при частичен неуспех — иначе повторно пускане би пратило
  // второ писмо на всички, които вече са го получили.
  if (marksWeek) {
    await supabase.from("app_settings").upsert({ key: "stale_tasks_last_sent_week", value: week }, { onConflict: "key" });
  }
  return json({ week, sent, failed: errors.length, errors });
});
