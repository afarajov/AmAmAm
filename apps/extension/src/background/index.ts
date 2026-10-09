import { checkAgentApiConnection, queryAgentApi } from "./apiClient";
import { isAgentHealthMessage, isAgentQueryMessage } from "../messages/agentMessages";
import { isSupportedPage } from "./activationPolicy";

async function showActivationError(tabId: number, message: string): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#b42318" }),
    chrome.action.setBadgeText({ tabId, text: "ERR" }),
    chrome.action.setTitle({ tabId, title: message })
  ]);
}

async function showUnsupportedPage(tabId: number): Promise<void> {
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.action.setTitle({
      tabId,
      title: "Open a regular HTTP(S) webpage to use ContextLayer"
    })
  ]);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined || !isSupportedPage(tab.url)) {
    if (tab.id !== undefined) {
      await showUnsupportedPage(tab.id);
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
  if (isAgentHealthMessage(message)) {
    void checkAgentApiConnection().then(sendResponse);
    return true;
  }
  if (!isAgentQueryMessage(message)) return false;

  void queryAgentApi(message.payload).then(sendResponse);
  return true;
});
