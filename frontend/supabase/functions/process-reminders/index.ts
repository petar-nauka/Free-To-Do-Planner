import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppSetting {
  key: string;
  value: string | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting process-reminders function");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if notifications are enabled
    const { data: enabledSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "email_notifications_enabled")
      .single();

    if (enabledSetting?.value !== "true") {
      console.log("Email notifications are disabled");
      return new Response(
        JSON.stringify({ message: "Notifications disabled", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch email settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "EMAIL_GATEWAY_URL",
        "EMAIL_GATEWAY_API_KEY",
        "email_from_name",
        "email_from_address",
        "email_reply_to",
      ]);

    const getSettingValue = (key: string): string => {
      const setting = settings?.find((s: AppSetting) => s.key === key);
      return setting?.value || "";
    };

    const gatewayUrl = getSettingValue("EMAIL_GATEWAY_URL");
    const apiKey = getSettingValue("EMAIL_GATEWAY_API_KEY");
    const fromName = getSettingValue("email_from_name") || "TaskFlow";
    const fromAddress = getSettingValue("email_from_address") || "noreply@example.com";
    const replyTo = getSettingValue("email_reply_to");

    if (!gatewayUrl || !apiKey) {
      console.log("Email gateway not configured");
      return new Response(
        JSON.stringify({ message: "Email gateway not configured", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    let processedReminders = 0;
    let processedRecurring = 0;

    // Process pending reminders
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_sent", false)
      .lte("reminder_date", now.toISOString());

    if (reminders && reminders.length > 0) {
      console.log(`Processing ${reminders.length} reminders`);

      for (const reminder of reminders) {
        try {
          // Get project name
          const { data: project } = await supabase
            .from("projects")
            .select("name")
            .eq("id", reminder.project_id)
            .single();

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #6366f1;">🔔 Напомняне: ${reminder.title}</h2>
              ${reminder.description ? `<p>${reminder.description}</p>` : ''}
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #6b7280;">
                  <strong>Проект:</strong> ${project?.name || 'N/A'}<br/>
                  <strong>Планирано за:</strong> ${new Date(reminder.reminder_date).toLocaleString("bg-BG")}
                </p>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 12px;">
                Това е автоматично напомняне от TaskFlow.
              </p>
            </div>
          `;

          const response = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <${fromAddress}>`,
              to: [reminder.reminder_email],
              subject: `🔔 Напомняне: ${reminder.title}`,
              html: emailHtml,
              ...(replyTo && { reply_to: replyTo }),
            }),
          });

          if (response.ok) {
            await supabase
              .from("reminders")
              .update({ is_sent: true, sent_at: now.toISOString() })
              .eq("id", reminder.id);
            processedReminders++;
            console.log(`Sent reminder: ${reminder.id}`);
          } else {
            console.error(`Failed to send reminder ${reminder.id}:`, await response.text());
          }
        } catch (error) {
          console.error(`Error processing reminder ${reminder.id}:`, error);
        }
      }
    }

    // Process recurring tasks
    const { data: recurringTasks } = await supabase
      .from("recurring_tasks")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now.toISOString());

    if (recurringTasks && recurringTasks.length > 0) {
      console.log(`Processing ${recurringTasks.length} recurring tasks`);

      for (const task of recurringTasks) {
        try {
          // Get project name
          const { data: project } = await supabase
            .from("projects")
            .select("name")
            .eq("id", task.project_id)
            .single();

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #6366f1;">🔄 Повтаряща се задача: ${task.title}</h2>
              ${task.description ? `<p>${task.description}</p>` : ''}
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #6b7280;">
                  <strong>Проект:</strong> ${project?.name || 'N/A'}<br/>
                  <strong>Тип:</strong> ${task.recurrence_type === 'daily' ? 'Ежедневно' : task.recurrence_type === 'weekly' ? 'Ежеседмично' : 'Ежемесечно'}
                </p>
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 12px;">
                Това е автоматично известие от TaskFlow.
              </p>
            </div>
          `;

          const response = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: `${fromName} <${fromAddress}>`,
              to: [task.notification_email],
              subject: `🔄 ${task.title}`,
              html: emailHtml,
              ...(replyTo && { reply_to: replyTo }),
            }),
          });

          if (response.ok) {
            // Calculate next run time
            const [hours, minutes] = task.time_of_day.split(':').map(Number);
            let nextRun = new Date();
            nextRun.setHours(hours, minutes, 0, 0);

            if (task.recurrence_type === 'daily') {
              nextRun.setDate(nextRun.getDate() + 1);
            } else if (task.recurrence_type === 'weekly') {
              nextRun.setDate(nextRun.getDate() + 7);
            } else if (task.recurrence_type === 'monthly') {
              nextRun.setMonth(nextRun.getMonth() + 1);
              if (task.day_of_month) {
                nextRun.setDate(task.day_of_month);
              }
            }

            await supabase
              .from("recurring_tasks")
              .update({ 
                last_run_at: now.toISOString(),
                next_run_at: nextRun.toISOString()
              })
              .eq("id", task.id);

            processedRecurring++;
            console.log(`Processed recurring task: ${task.id}, next run: ${nextRun.toISOString()}`);
          } else {
            console.error(`Failed to send recurring task ${task.id}:`, await response.text());
          }
        } catch (error) {
          console.error(`Error processing recurring task ${task.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Reminders processed", 
        reminders: processedReminders,
        recurring: processedRecurring
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in process-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
