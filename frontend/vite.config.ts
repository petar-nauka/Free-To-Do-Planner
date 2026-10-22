import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { cpSync } from "fs";
import { componentTagger } from "lovable-tagger";

// Шрифтовете на бялата дъска (Excalidraw) се сервират от нашия сървър, не от CDN —
// CSP-то в index.html (font-src 'self') иначе ги блокира. Копират се от инсталирания
// пакет при всяко пускане (dev и build), затова не са в git и следват версията му.
// Адресът им се задава в src/components/whiteboards/excalidrawAssets.ts.
function excalidrawFonts(): Plugin {
  return {
    name: "excalidraw-fonts",
    buildStart() {
      cpSync(
        path.resolve(__dirname, "node_modules/@excalidraw/excalidraw/dist/prod/fonts"),
        path.resolve(__dirname, "public/excalidraw/fonts"),
        { recursive: true },
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), "");
  // DEV-only: заобикаля CORS към self-hosted Supabase, който позволява само
  // production origin-а. Задай DEV_SUPABASE_PROXY_TARGET в .env.development.local
  // (напр. https://supabase.твоя-домейн) + VITE_SUPABASE_URL=http://localhost:3000.
  // Не влияе на production build (server.proxy важи само за dev сървъра).
  const proxyTarget = env.DEV_SUPABASE_PROXY_TARGET;
  const supabaseProxy = proxyTarget
    ? {
        // По-специфични пътища (/v1), за да НЕ прихващат React route-ове като /auth, /settings.
        "/rest/v1": { target: proxyTarget, changeOrigin: true, secure: true },
        "/auth/v1": { target: proxyTarget, changeOrigin: true, secure: true },
        "/storage/v1": { target: proxyTarget, changeOrigin: true, secure: true },
        "/functions/v1": { target: proxyTarget, changeOrigin: true, secure: true },
        "/realtime/v1": { target: proxyTarget, changeOrigin: true, secure: true, ws: true },
      }
    : undefined;

  return {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      proxy: supabaseProxy,
    },
    plugins: [react(), excalidrawFonts(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
