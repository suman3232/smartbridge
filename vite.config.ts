import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt", // we surface a "New version available" prompt, no silent reload
      injectRegister: false, // registration handled by the useRegisterSW() hook
      includeAssets: ["favicon.svg", "favicon-32x32.png", "apple-touch-icon.png", "robots.txt"],
      manifest: {
        name: "OfferBridge — Share Card Offers & Earn",
        short_name: "OfferBridge",
        description:
          "Shop with card discounts or earn by placing orders for others. Deals, wallet, price tracker and referrals.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#070b14",
        background_color: "#070b14",
        categories: ["shopping", "finance"],
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Browse deals", url: "/deals" },
          { name: "Wallet", url: "/wallet" },
          { name: "Refer & Earn", url: "/refer" },
        ],
      },
      workbox: {
        // Precache the public app shell + build assets only. Do NOT add runtime
        // caching for Supabase — auth, wallet, KYC, and all protected/API data
        // must always hit the network and are never stored on disk.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA deep links (/dashboard, /r/CODE, /deals/:id, OAuth return to /auth)
        // resolve to the cached app shell so routing + auth redirects keep working.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          // Public Google Fonts only (safe, non-sensitive) so type renders offline.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // PWA active in production builds; test via `vite preview`
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("gsap")) return "gsap";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack/react-query")) return "query";
          if (id.includes("react-dom") || id.includes("react-router")) return "react-vendor";
          if (id.includes("lucide-react")) return "icons";
        },
      },
    },
  },
}));
