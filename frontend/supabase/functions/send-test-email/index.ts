import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipientEmail: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting send-test-email function");

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Only admins can send test emails");
    }

    // Get request body
    const { recipientEmail }: TestEmailRequest = await req.json();
    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    console.log("Sending test email to:", recipientEmail);

    // Fetch email settings from database using service role
    const supabaseServiceRole = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settings, error: settingsError } = await supabaseServiceRole
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "EMAIL_GATEWAY_URL",
        "EMAIL_GATEWAY_API_KEY",
        "email_from_name",
        "email_from_address",
        "email_reply_to",
      ]);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch email settings");
    }

    const getSettingValue = (key: string): string => {
      const setting = settings?.find((s: any) => s.key === key);
      return setting?.value || "";
    };

    const gatewayUrl = getSettingValue("EMAIL_GATEWAY_URL");
    const apiKey = getSettingValue("EMAIL_GATEWAY_API_KEY");
    const fromName = getSettingValue("email_from_name") || "TaskFlow";
    const fromAddress = getSettingValue("email_from_address") || "noreply@example.com";
    const replyTo = getSettingValue("email_reply_to");

    if (!gatewayUrl || !apiKey) {
      throw new Error("Email gateway URL and API key must be configured");
    }

    console.log("Using gateway URL:", gatewayUrl);
    console.log("From:", `${fromName} <${fromAddress}>`);

    // Send test email via configured gateway
    const emailPayload = {
      from: `${fromName} <${fromAddress}>`,
      to: [recipientEmail],
      subject: "🧪 Тестов имейл от TaskFlow",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6366f1;">✅ Тестов имейл</h1>
          <p>Здравейте!</p>
          <p>Това е тестов имейл, изпратен от вашата TaskFlow инстанция.</p>
          <p>Ако получавате този имейл, значи email gateway настройките са конфигурирани правилно.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #6b7280; font-size: 12px;">
            Изпратено от: ${fromName} &lt;${fromAddress}&gt;<br/>
            Време: ${new Date().toLocaleString("bg-BG")}
          </p>
        </div>
      `,
      ...(replyTo && { reply_to: replyTo }),
    };

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    const responseText = await response.text();
    console.log("Gateway response status:", response.status);
    console.log("Gateway response:", responseText);

    if (!response.ok) {
      throw new Error(`Email gateway error: ${response.status} - ${responseText}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-test-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
