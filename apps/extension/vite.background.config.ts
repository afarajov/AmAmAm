import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: new URL("./src/background/index.ts", import.meta.url).pathname,
      formats: ["es"],
      fileName: () => "background.js"
    }
  }
});
