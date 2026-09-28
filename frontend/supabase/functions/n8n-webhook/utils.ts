// CORS: origin от env (fallback '*' за server-to-server n8n, което игнорира CORS).
// Реалната защита е задължителният webhook secret, не CORS.
const allowedOrigin = Deno.env.get("N8N_ALLOWED_ORIGIN") ?? "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Константно-времево сравнение (без early-exit по съдържание).
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export { corsHeaders };
