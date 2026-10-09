import { createRoot } from "react-dom/client";

import { createRuntime } from "../bootstrap/createRuntime";
import { AssistantWidget } from "../ui/AssistantWidget";
import styles from "./styles.css?inline";

const HOST_ID = "contextlayer-extension-root";
export const ACTIVATE_EVENT = "contextlayer:activate";

function mountExtensionShell(): void {
  const existingHost = document.getElementById(HOST_ID);
  if (existingHost) {
    existingHost.dispatchEvent(new CustomEvent(ACTIVATE_EVENT));
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.dataset.contextlayerUi = "true";

  const shadowRoot = host.attachShadow({ mode: "open" });
  const styleElement = document.createElement("style");
  const appRoot = document.createElement("div");

  styleElement.textContent = styles;
  shadowRoot.append(styleElement, appRoot);
  document.documentElement.append(host);

  const runtime = createRuntime(document);
  createRoot(appRoot).render(
    <AssistantWidget
      activationTarget={host}
      activationEvent={ACTIVATE_EVENT}
      agentSession={runtime.agentSession}
      modeLabel={runtime.modeLabel}
    />
  );
}

mountExtensionShell();
