import { Sparkles } from "lucide-react";
import { createRoot } from "react-dom/client";

import styles from "./styles.css?inline";

const HOST_ID = "contextlayer-extension-root";

function ExtensionShell() {
  return (
    <button
      className="contextlayer-launcher"
      type="button"
      aria-label="Open ContextLayer assistant"
      title="ContextLayer is ready"
    >
      <Sparkles aria-hidden="true" size={22} strokeWidth={2} />
    </button>
  );
}

function mountExtensionShell(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.contextlayerUi = "true";

  const shadowRoot = host.attachShadow({ mode: "open" });
  const styleElement = document.createElement("style");
  const appRoot = document.createElement("div");

  styleElement.textContent = styles;
  shadowRoot.append(styleElement, appRoot);
  document.documentElement.append(host);

  createRoot(appRoot).render(<ExtensionShell />);
}

mountExtensionShell();
