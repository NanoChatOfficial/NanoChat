import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const additionalHosts =
  process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS?.split(",") ?? [];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: ["localhost", ...additionalHosts],
    host: "0.0.0.0",
  },
});
