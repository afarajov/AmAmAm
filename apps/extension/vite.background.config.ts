import { defineConfig, type Plugin } from "vite";

function manifestPlugin(mode: string): Plugin {
  const manifest = {
    manifest_version: 3,
    name: "ContextLayer",
    description: "A context-aware assistant for the webpage you are viewing.",
    version: "0.1.0",
    permissions: ["activeTab", "scripting"],
    ...(mode === "api"
      ? { host_permissions: ["http://127.0.0.1:8787/*"] }
      : {}),
    background: {
      service_worker: "background.js",
      type: "module"
    },
    action: {
      default_title: "Activate ContextLayer"
    }
  };

  return {
    name: "contextlayer-manifest",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: `${JSON.stringify(manifest, null, 2)}\n`
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [manifestPlugin(mode)],
  publicDir: false,
  build: {
    outDir: mode === "api" ? "dist" : "dist-mock",
    emptyOutDir: false,
    lib: {
      entry: new URL("./src/background/index.ts", import.meta.url).pathname,
      formats: ["es"],
      fileName: () => "background.js"
    }
  }
}));
