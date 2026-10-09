import { queryAgentApi } from "./apiClient";
import { isAgentQueryMessage } from "../messages/agentMessages";

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

function isSupportedPage(url: string | undefined): boolean {
  if (!url) return false;

  try {
    return SUPPORTED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

async function showActivationError(tabId: number, message: string): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" }),
    chrome.action.setBadgeText({ tabId, text: "ERR" }),
    chrome.action.setTitle({ tabId, title: message })
  ]);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined || !isSupportedPage(tab.url)) {
    if (tab.id !== undefined) {
      await showActivationError(tab.id, "ContextLayer cannot run on this page.");
    }
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });

    await Promise.all([
      chrome.action.setBadgeText({ tabId: tab.id, text: "" }),
      chrome.action.setTitle({ tabId: tab.id, title: "ContextLayer is active" })
    ]);
  } catch (error) {
    console.warn("ContextLayer activation failed", error);
    await showActivationError(tab.id, "ContextLayer activation failed.");
  }
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isAgentQueryMessage(message)) return false;

  void queryAgentApi(message.payload).then(sendResponse);
  return true;
});
