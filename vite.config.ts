import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(), // runs the Hono Worker inside `vite dev`, same origin as the SPA
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "reggie/*.png", "reggie-email.png"],
      manifest: {
        name: "Reggie: Seminar Registration",
        short_name: "Reggie",
        description: "Register for seminars and get your QR ticket from Reggie.",
        start_url: "/",
        display: "standalone",
        background_color: "#FFFFFF",
        theme_color: "#800000",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//], // never serve the app shell for API calls
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [], // no API caching at all: registration and check-in are online-only
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
});
