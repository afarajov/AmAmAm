import { defineConfig, loadEnv, type Plugin } from "vite";

import { normalizeApiOrigin } from "./build/apiOrigin.ts";

function manifestPlugin(mode: string, apiOrigin: string): Plugin {
  const manifest = {
    manifest_version: 3,
    name: "ContextLayer",
    description: "A context-aware assistant for the webpage you are viewing.",
    version: "0.1.0",
    permissions: ["activeTab", "scripting", "storage"],
    ...(mode === "api"
      ? { host_permissions: [`${apiOrigin}/*`] }
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

export default defineConfig(({ mode }) => {
  const apiOrigin = normalizeApiOrigin(loadEnv(mode, process.cwd(), "").VITE_CONTEXTLAYER_API_BASE_URL);
  return {
    plugins: [manifestPlugin(mode, apiOrigin)],
    publicDir: false,
    define: {
      "import.meta.env.VITE_CONTEXTLAYER_API_BASE_URL": JSON.stringify(apiOrigin)
    },
    build: {
      outDir: mode === "api" ? "dist" : "dist-mock",
      emptyOutDir: false,
      lib: {
        entry: new URL("./src/background/index.ts", import.meta.url).pathname,
        formats: ["es"],
        fileName: () => "background.js"
      }
    }
  };
});
