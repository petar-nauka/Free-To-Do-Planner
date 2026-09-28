import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting check-overdue-tasks function");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Read settings ──────────────────────────────────────────────────
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "overdue_notifications_enabled",
        "overdue_task_days",
        "EMAIL_GATEWAY_URL",
        "EMAIL_GATEWAY_API_KEY",
        "email_from_name",
        "email_from_address",
        "email_reply_to",
        "email_notifications_enabled",
      ]);

    const getSetting = (key: string, fallback = ""): string => {
      const row = settingsRows?.find((s: any) => s.key === key);
      return row?.value ?? fallback;
    };

    // Check if global email is enabled
    if (getSetting("email_notifications_enabled") !== "true") {
      console.log("Email notifications globally disabled");
      return new Response(
        JSON.stringify({ message: "Email notifications disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if overdue notifications specifically are enabled
    if (getSetting("overdue_notifications_enabled", "true") !== "true") {
      console.log("Overdue task notifications disabled");
      return new Response(
        JSON.stringify({ message: "Overdue notifications disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const overdueDays = parseInt(getSetting("overdue_task_days", "7"), 10) || 7;

    const gatewayUrl = getSetting("EMAIL_GATEWAY_URL");
    const apiKey = getSetting("EMAIL_GATEWAY_API_KEY");
    const fromName = getSetting("email_from_name") || "TaskFlow";
    const fromAddress = getSetting("email_from_address") || "noreply@example.com";
    const replyTo = getSetting("email_reply_to");

    if (!gatewayUrl || !apiKey) {
      console.log("Email gateway not configured");
      return new Response(
        JSON.stringify({ message: "Email gateway not configured", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Find overdue tasks ─────────────────────────────────────────────
    // Tasks are "overdue" when: due_date + overdueDays days ago has passed
    // and they haven't been notified yet (overdue_notified_at IS NULL)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - overdueDays);
    const cutoffISO = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const { data: overdueTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, priority, status, user_id, project_id")
      .not("due_date", "is", null)
      .lte("due_date", cutoffISO)
      .is("overdue_notified_at", null)
      .is("archived_at", null)
      .order("due_date", { ascending: true });

    if (tasksError) {
      console.error("Error fetching overdue tasks:", tasksError);
      throw tasksError;
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log("No overdue tasks to notify about");
      return new Response(
        JSON.stringify({ message: "No overdue tasks", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${overdueTasks.length} overdue tasks`);

    // ── 3. Group tasks by user_id ─────────────────────────────────────────
    const tasksByUser: Record<string, typeof overdueTasks> = {};
    for (const task of overdueTasks) {
      if (!tasksByUser[task.user_id]) tasksByUser[task.user_id] = [];
      tasksByUser[task.user_id].push(task);
    }

    // ── 4. Fetch project names once ───────────────────────────────────────
    const projectIds = [...new Set(overdueTasks.map((t: any) => t.project_id))];
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);

    const projectMap: Record<string, string> = {};
    for (const p of projects || []) {
      projectMap[p.id] = p.name;
    }

    // ── 5. Fetch user emails from profiles ────────────────────────────────
    const userIds = Object.keys(tasksByUser);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .in("user_id", userIds);

    const profileMap: Record<string, { email: string; name: string }> = {};
    for (const p of profiles || []) {
      profileMap[p.user_id] = {
        email: p.email || "",
        name: p.display_name || p.email || "Потребител",
      };
    }

    // ── 6. Priority labels ────────────────────────────────────────────────
    const priorityLabel = (p: string) =>
      p === "high" ? "🔴 Висок" : p === "medium" ? "🟡 Среден" : "🟢 Нисък";

    const daysOverdue = (dueDateStr: string): number => {
      const due = new Date(dueDateStr);
      const today = new Date();
      return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    };

    // ── 7. Send one email per user ────────────────────────────────────────
    let processedCount = 0;
    const notifiedTaskIds: string[] = [];

    for (const [userId, tasks] of Object.entries(tasksByUser)) {
      const profile = profileMap[userId];
      if (!profile?.email) {
        console.log(`No email for user ${userId}, skipping`);
        continue;
      }

      const taskRows = tasks
        .map((t: any) => {
          const days = daysOverdue(t.due_date);
          const projectName = projectMap[t.project_id] || "Непознат проект";
          return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px; font-weight: 500;">${t.title}</td>
            <td style="padding: 10px 8px; color: #6b7280;">${projectName}</td>
            <td style="padding: 10px 8px;">${priorityLabel(t.priority)}</td>
            <td style="padding: 10px 8px; color: #ef4444; font-weight: 600;">
              ${new Date(t.due_date).toLocaleDateString("bg-BG")}
              <br/><span style="font-size:12px;">(${days} дни закъснение)</span>
            </td>
          </tr>`;
        })
        .join("");

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #6366f1, #a855f7); padding: 24px; border-radius: 12px; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Просрочени задачи</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">Здравейте, ${profile.name}!</p>
          </div>

          <p style="color: #374151; font-size: 15px; line-height: 1.6;">
            Имате <strong>${tasks.length} задач${tasks.length === 1 ? "а" : "и"}</strong>,
            чиито краен срок е изтекъл преди повече от <strong>${overdueDays} дни</strong>.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Задача</th>
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Проект</th>
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Приоритет</th>
                <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Краен срок</th>
              </tr>
            </thead>
            <tbody>${taskRows}</tbody>
          </table>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              💡 Влезте в приложението и актуализирайте или архивирайте тези задачи.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Автоматично известие от TaskFlow &bull; ${new Date().toLocaleString("bg-BG")}
          </p>
        </div>`;

      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: [profile.email],
          subject: `⚠️ ${tasks.length} просроче${tasks.length === 1 ? "на задача" : "ни задачи"} — ${tasks.length > 1 ? "моля, прегледайте" : tasks[0].title}`,
          html: emailHtml,
          ...(replyTo && { reply_to: replyTo }),
        }),
      });

      if (response.ok) {
        tasks.forEach((t: any) => notifiedTaskIds.push(t.id));
        processedCount++;
        console.log(`Sent overdue email to ${profile.email} (${tasks.length} tasks)`);
      } else {
        const errText = await response.text();
        console.error(`Failed to send to ${profile.email}: ${response.status} — ${errText}`);
      }
    }

    // ── 8. Mark tasks as notified ─────────────────────────────────────────
    if (notifiedTaskIds.length > 0) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ overdue_notified_at: now })
        .in("id", notifiedTaskIds);

      if (updateError) {
        console.error("Error updating overdue_notified_at:", updateError);
      } else {
        console.log(`Marked ${notifiedTaskIds.length} tasks as notified`);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Overdue tasks processed",
        usersNotified: processedCount,
        tasksNotified: notifiedTaskIds.length,
        overdueDays,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-overdue-tasks:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
