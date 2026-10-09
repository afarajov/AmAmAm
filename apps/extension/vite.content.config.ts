import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "oxc",
    lib: {
      entry: new URL("./src/content/index.tsx", import.meta.url).pathname,
      name: "ContextLayerContent",
      formats: ["iife"],
      fileName: () => "content.js"
    }
  }
});
