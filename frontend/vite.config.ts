import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Any request to /api/* is forwarded to the Flask backend.
      // This eliminates all CORS issues in development — the browser
      // only ever talks to localhost:8080, Vite proxies behind the scenes.
      "/api": {
        target: "http://localhost:7860",
        changeOrigin: true,
        secure: false,
        // No rewrite needed — Flask routes are already under /api
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
