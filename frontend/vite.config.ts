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

  // 路径别名配置
  resolve: {
    alias: {
      "@/bindings": resolve(__dirname, "bindings"),
      "@": resolve(__dirname, "src"),
      // Tauri migration stubs
      "@tauri-apps/plugin-dialog": resolve(__dirname, "src/tauri-stubs/dialog"),
      "@tauri-apps/plugin-shell": resolve(__dirname, "src/tauri-stubs/shell"),
      "@tauri-apps/api/event": resolve(__dirname, "src/tauri-stubs/event"),
      "@tauri-apps/plugin-notification": resolve(__dirname, "src/tauri-stubs/notification"),
      "@tauri-apps/plugin-store": resolve(__dirname, "src/tauri-stubs/store"),
      "socket.io-client": resolve(__dirname, "src/tauri-stubs/socketio"),
    }
  },

  clearScreen: false,
  server: {
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
}));