import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Inline config: cegah Vite mencari postcss.config.* di folder induk
  css: { postcss: {} },
  server: {
    allowedHosts: ["archive.nyanpixel.my.id"],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: ["archive.nyanpixel.my.id"],
  },
});