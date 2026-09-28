import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationQueueItem {
  id: string;
  type: string;
  project_id: string;
  item_id: string;
  item_title: string;
  created_by: string;
  created_at: string;
}

interface AppSetting {
  key: string;
  value: string | null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting process-notifications function");

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

    // Fetch unprocessed notifications
    const { data: notifications, error: fetchError } = await supabase
      .from("notification_queue")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log("No pending notifications");
      return new Response(
        JSON.stringify({ message: "No pending notifications", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${notifications.length} notifications`);

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

    let processedCount = 0;

    for (const notification of notifications as NotificationQueueItem[]) {
      try {
        console.log(`Processing notification ${notification.id}: ${notification.type}`);

        // Get project details
        const { data: project } = await supabase
          .from("projects")
          .select("name, user_id")
          .eq("id", notification.project_id)
          .single();

        if (!project) {
          console.log(`Project not found for notification ${notification.id}`);
          continue;
        }

        // Get creator's profile
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("user_id", notification.created_by)
          .single();

        const creatorName = creatorProfile?.display_name || creatorProfile?.email || "Член на екипа";

        // Get all team members to notify (excluding the creator)
        const recipientIds: string[] = [];

        // Add project owner if different from creator
        if (project.user_id !== notification.created_by) {
          recipientIds.push(project.user_id);
        }

        // Get accepted project members (excluding creator)
        const { data: members } = await supabase
          .from("project_members")
          .select("user_id")
          .eq("project_id", notification.project_id)
          .eq("status", "accepted")
          .neq("user_id", notification.created_by);

        if (members) {
          for (const member of members) {
            if (!recipientIds.includes(member.user_id)) {
              recipientIds.push(member.user_id);
            }
          }
        }

        if (recipientIds.length === 0) {
          console.log(`No recipients for notification ${notification.id}`);
          await supabase
            .from("notification_queue")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", notification.id);
          continue;
        }

        // Get recipient emails
        const { data: recipientProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", recipientIds);

        const recipientEmails = recipientProfiles
          ?.map((p) => p.email)
          .filter((email): email is string => !!email) || [];

        if (recipientEmails.length === 0) {
          console.log(`No valid recipient emails for notification ${notification.id}`);
          await supabase
            .from("notification_queue")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", notification.id);
          continue;
        }

        // Prepare email content based on notification type
        const isTask = notification.type === "task_created";
        const itemType = isTask ? "задача" : "документ";
        const itemTypeCapital = isTask ? "Задача" : "Документ";
        const emoji = isTask ? "📋" : "📄";

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #6366f1;">${emoji} Нов${isTask ? "а" : ""} ${itemType} в "${project.name}"</h2>
            <p>Здравейте!</p>
            <p><strong>${creatorName}</strong> създаде нов${isTask ? "а" : ""} ${itemType} в проекта "${project.name}":</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 18px; font-weight: bold;">${notification.item_title}</p>
              <p style="margin: 5px 0 0; color: #6b7280; font-size: 14px;">
                ${itemTypeCapital} • ${new Date(notification.created_at).toLocaleString("bg-BG")}
              </p>
            </div>
            <p>Влезте в TaskFlow, за да видите детайлите.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 12px;">
              Това е автоматично известие от TaskFlow.
            </p>
          </div>
        `;

        // Send email
        const emailPayload = {
          from: `${fromName} <${fromAddress}>`,
          to: recipientEmails,
          subject: `${emoji} Нов${isTask ? "а" : ""} ${itemType}: "${notification.item_title}" в проект "${project.name}"`,
          html: emailHtml,
          ...(replyTo && { reply_to: replyTo }),
        };

        console.log(`Sending email to ${recipientEmails.length} recipients`);

        const response = await fetch(gatewayUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Email gateway error: ${response.status} - ${errorText}`);
        }

        // Mark as processed
        await supabase
          .from("notification_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", notification.id);

        processedCount++;
        console.log(`Successfully processed notification ${notification.id}`);
      } catch (error: any) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Mark with error but don't retry immediately
        await supabase
          .from("notification_queue")
          .update({ 
            processed_at: new Date().toISOString(),
            error: error.message 
          })
          .eq("id", notification.id);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Notifications processed", 
        processed: processedCount,
        total: notifications.length 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in process-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
