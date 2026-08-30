import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import wails from "@wailsio/runtime/plugins/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    tailwindcss(),
    wails("./bindings")
  ],

  resolve: {
    alias: {
      "@/bindings": resolve(__dirname, "bindings"),
      "@": resolve(__dirname, "src"),
    }
  },

  clearScreen: false,
  server: {
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
}));
