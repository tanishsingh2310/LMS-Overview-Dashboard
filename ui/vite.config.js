import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  base: "/local/universitydashboard/ui/",

  build: {
    outDir: resolve(__dirname, "../build/ui"),
    emptyOutDir: true,
    manifest: "manifest.json",

    rollupOptions: {
      input: resolve(__dirname, "src/main.jsx"),
    },
  },
});