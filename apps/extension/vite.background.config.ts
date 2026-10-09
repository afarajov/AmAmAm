import { defineConfig, loadEnv, type Plugin } from "vite";
import { readFileSync } from "node:fs";

import { normalizeApiOrigin } from "./build/apiOrigin.ts";

const ICON_SIZES = [16, 32, 48, 128] as const;

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
    icons: Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon${size}.png`])),
    action: {
      default_title: "Activate ContextLayer",
      default_icon: Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/icon${size}.png`]))
    }
  };

  return {
    name: "contextlayer-manifest",
    generateBundle() {
      for (const size of ICON_SIZES) {
        this.emitFile({
          type: "asset",
          fileName: `icons/icon${size}.png`,
          source: readFileSync(new URL(`./assets/icon${size}.png`, import.meta.url))
        });
      }
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
