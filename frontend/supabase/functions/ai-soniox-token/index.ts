import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: same origin env var as n8n-webhook (frontend domain), fallback '*'.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("N8N_ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SONIOX_TOKEN_URL = "https://api.soniox.com/v1/auth/temporary-api-key";

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Establish who the caller is from their JWT (user-scoped client — never trust a client-supplied user id).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // 2) Read the user's Soniox key with the service role client (bypasses RLS — user_ai_secrets has no
    // policies for the authenticated role, so only service_role can read the raw key).
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: secret, error: secretErr } = await adminClient
      .from("user_ai_secrets")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", "soniox")
      .maybeSingle();

    if (secretErr) {
      console.error("ai-soniox-token: DB error reading user_ai_secrets:", secretErr.message);
      return jsonResponse({ error: "DB error" }, 500);
    }
    if (!secret?.api_key) {
      return jsonResponse({ error: "No Soniox key configured" }, 400);
    }

    // 3) Mint a short-lived temporary key for the browser. The long-lived key never leaves this function.
    const resp = await fetch(SONIOX_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usage_type: "transcribe_websocket", expires_in_seconds: 300 }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("ai-soniox-token: Soniox token error:", resp.status, text);
      // Do not leak the raw upstream error body to the client.
      return jsonResponse({ error: "Soniox token error" }, 502);
    }

    const data = await resp.json();
    return jsonResponse({ apiKey: data.api_key, expiresAt: data.expires_at });
  } catch (error) {
    console.error("ai-soniox-token: unexpected error:", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
