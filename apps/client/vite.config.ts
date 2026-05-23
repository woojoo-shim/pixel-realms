import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true, // expose on LAN so phones can connect
  },
  build: {
    target: "es2022",
  },
});
