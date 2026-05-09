import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: `/api/*` proxies to FastAPI (`VITE_DEV_API_TARGET` or :8900) so fetch("/api/calculate") works without CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:8900",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
