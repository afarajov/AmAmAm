import {
  AlertCircle,
  CircleCheck,
  CircleX,
  Clock3,
  FileText,
  LocateFixed,
  RotateCcw,
  Send,
  Settings,
  X
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { ActionExecutionResult, AgentResponse } from "@contextlayer/shared";
import type { ConnectionCheckResult } from "../background/apiClient";

import type {
  AgentSession,
  AgentSessionProgress
} from "../integration/agentSession";
import {
  clearChatHistory,
  DEFAULT_SETTINGS,
  deleteChatSession,
  loadHistory,
  loadSettings,
  messagesForStorage,
  messagesFromStorage,
  queryWithPreferences,
  saveChatSession,
  saveSettings,
  type ChatSession,
  type UserSettings
} from "../storage/userData";
import { presentActionResult } from "./actionPresentation";
import { HistoryPanel, MessageActions } from "./ChatUtilities";
import { LotusMark } from "./LotusMark";
import { SettingsPanel } from "./SettingsPanel";
import type { ChatMessage, RequestStatus } from "./types";

interface AssistantWidgetProps {
  activationTarget: HTMLElement;
  activationEvent: string;
  agentSession: AgentSession;
  modeLabel: string;
  checkConnection: () => Promise<ConnectionCheckResult>;
}

const PROGRESS_MESSAGES: Record<AgentSessionProgress, string> = {
  scanning: "Scanning the current page…",
  "waiting-for-content": "The page is still loading. Waiting for readable text…",
  requesting: "Asking ContextLayer AI…",
  rescanning: "The page changed. Scanning again…"
};

function readableError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  switch (code) {
    case "PAGE_TEXT_NOT_FOUND":
      return "No readable page text was found.";
    case "PAGE_CHANGED":
      return "The page changed. Submit the request again for the current page.";
    case "RESCAN_REQUIRED":
      return "The page changed again. A new scan is required.";
    case "MODEL_TIMEOUT":
      return "The AI backend took too long to respond. Try again.";
    case "RATE_LIMITED":
      return "The AI backend is busy. Wait a moment and try again.";
    case "INVALID_RESPONSE":
      return "The AI backend returned an invalid response. No page action was run.";
    case "MODEL_ERROR":
      return "The AI provider could not produce a valid response. No page action was run.";
    case "INTERNAL_ERROR":
      return "The ContextLayer backend is unavailable. No page action was run.";
    default:
      return error instanceof Error ? error.message : "The agent request failed unexpectedly.";
  }
}

function createMessage(text: string, role: ChatMessage["role"]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text
  };
}

function createAssistantMessage(
  response: AgentResponse,
  executionResults: ActionExecutionResult[],
  retryQuery: string
): ChatMessage {
  const failedResults = executionResults.filter((result) => !result.success);
  const successfulResults = executionResults.filter((result) => result.success);
  const affectedElementCount = executionResults.reduce(
    (total, result) => total + result.affectedElementIds.length,
    0
  );
  let text = response.message;

  if (failedResults.length > 0) {
    text = successfulResults.length > 0 || affectedElementCount > 0
      ? "Some page actions completed, but others could not be applied."
      : "I could not apply the requested page changes.";
  }

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text,
    retryQuery,
    references: response.references,
    executionResults
  };
}

function createLocalActionMessage(
  text: string,
  executionResults: ActionExecutionResult[]
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text,
    executionResults
  };
}

export function AssistantWidget({
  activationTarget,
  activationEvent,
  agentSession,
  modeLabel,
  checkConnection
}: AssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "history" | "settings">("chat");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [storageReady, setStorageReady] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPageModifications, setHasPageModifications] = useState(false);
  const [activityMessage, setActivityMessage] = useState("Waiting for response…");
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(
    activationTarget.ownerDocument.title || "Current page"
  );
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);
  const connectionCheckedRef = useRef(false);
  const backendConfirmedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([loadSettings(), loadHistory()]).then(([storedSettings, storedHistory]) => {
      if (!active) return;
      setSettings(storedSettings);
      setHistory(storedHistory);
      const currentUrl = activationTarget.ownerDocument.location.href;
      const latest = storedHistory.find((session) => session.url === currentUrl);
      if (latest && storedSettings.saveHistory) {
        setSessionId(latest.id);
        setMessages(messagesFromStorage(latest.messages));
      }
      setStorageReady(true);
    });
    return () => { active = false; };
  }, [activationTarget]);

  useEffect(() => {
    const host = activationTarget;
    host.dataset.contextlayerTheme = settings.theme;
    host.dataset.contextlayerTextSize = settings.textSize;
    host.dataset.contextlayerButtonSize = settings.buttonSize;
    host.dataset.contextlayerButtonPosition = settings.buttonPosition;
    host.style.setProperty("--cl-accent", settings.accentColor);
    if (storageReady) void saveSettings(settings);
  }, [activationTarget, settings, storageReady]);

  useEffect(() => {
    if (!storageReady || !settings.saveHistory || messages.length === 0) return;
    const session: ChatSession = {
      id: sessionId,
      url: activationTarget.ownerDocument.location.href,
      title: activationTarget.ownerDocument.title || "Current page",
      updatedAt: Date.now(),
      messages: messagesForStorage(messages)
    };
    void saveChatSession(session).then(setHistory);
  }, [activationTarget, messages, sessionId, settings.saveHistory, storageReady]);

  useEffect(() => {
    const togglePanel = () => setIsOpen((current) => !current);
    activationTarget.addEventListener(activationEvent, togglePanel);
    return () => activationTarget.removeEventListener(activationEvent, togglePanel);
  }, [activationEvent, activationTarget]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || connectionCheckedRef.current) return;
    connectionCheckedRef.current = true;
    void checkConnection().then((result) => {
      if (backendConfirmedRef.current) return;
      const messages: Record<ConnectionCheckResult["status"], string | null> = {
        ready: null,
        offline: "The ContextLayer backend is offline. Start it and try again.",
        timeout: "The ContextLayer backend did not respond to the connection check.",
        invalid: "The configured backend is not a compatible ContextLayer API."
      };
      setConnectionNotice(messages[result.status]);
    }).catch(() => setConnectionNotice("The ContextLayer backend is offline. Start it and try again."));
  }, [checkConnection, isOpen]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    activationTarget.ownerDocument.addEventListener("keydown", closeOnEscape);
    return () => activationTarget.ownerDocument.removeEventListener("keydown", closeOnEscape);
  }, [activationTarget]);

  useEffect(() => {
    const pageWindow = activationTarget.ownerDocument.defaultView;
    if (!pageWindow) return;

    let currentUrl = pageWindow.location.href;
    const detectNavigation = () => {
      const nextUrl = pageWindow.location.href;
      if (nextUrl === currentUrl) return;

      currentUrl = nextUrl;
      setPageTitle(activationTarget.ownerDocument.title || "Current page");
      agentSession.invalidatePage();
      void loadHistory().then((storedHistory) => {
        setHistory(storedHistory);
        const latest = settings.saveHistory
          ? storedHistory.find((session) => session.url === nextUrl)
          : undefined;
        setSessionId(latest?.id ?? crypto.randomUUID());
        setMessages(latest ? messagesFromStorage(latest.messages) : []);
      });
      setHasPageModifications(false);
      setErrorMessage(null);
      setStatus("idle");
      setPageNotice("Page changed. Previous context was cleared.");
    };

    pageWindow.addEventListener("popstate", detectNavigation);
    pageWindow.addEventListener("hashchange", detectNavigation);
    const intervalId = pageWindow.setInterval(detectNavigation, 300);

    return () => {
      pageWindow.removeEventListener("popstate", detectNavigation);
      pageWindow.removeEventListener("hashchange", detectNavigation);
      pageWindow.clearInterval(intervalId);
    };
  }, [activationTarget, agentSession, settings.saveHistory]);

  const runQuery = async (rawQuery: string, appendUserMessage: boolean) => {
    const query = rawQuery.trim();
    if (!query || requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    if (appendUserMessage) {
      setMessages((current) => [...current, createMessage(query, "user")]);
    }
    setDraft("");
    setErrorMessage(null);
    setHasPageModifications(false);
    setPageNotice(null);
    setActivityMessage(PROGRESS_MESSAGES.scanning);
    setStatus("loading");

    try {
      const {
        response,
        executionResults,
        hasPageModifications: hasChanges,
        recoveredFromStale
      } = await agentSession.submit(queryWithPreferences(query, settings), {
        onProgress: (progress) => setActivityMessage(PROGRESS_MESSAGES[progress])
      });
      backendConfirmedRef.current = true;
      setConnectionNotice(null);
      setMessages((current) => [
        ...current,
        createAssistantMessage(response, executionResults, query)
      ]);
      setHasPageModifications(hasChanges);
      setPageNotice(
        recoveredFromStale ? "The page changed during processing and was rescanned." : null
      );
      setStatus("idle");
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
      if (code === "PAGE_CHANGED") {
        setMessages([]);
        setPageNotice("Page changed. Previous context was cleared.");
      }
      setErrorMessage(readableError(error));
      setStatus("error");
    } finally {
      requestInFlightRef.current = false;
    }
  };

  const submitMessage = async () => runQuery(draft, true);

  const handleReferenceClick = async (messageId: string, elementId: string) => {
    try {
      const result = await agentSession.scrollToReference(elementId);
      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? {
              ...message,
              executionResults: [
                ...(message.executionResults ?? []).filter((executionResult) => (
                  executionResult.type !== "HIGHLIGHT" && executionResult.type !== "SCROLL_TO"
                )),
                ...result.executionResults
              ]
            }
          : message
      )));
      setHasPageModifications(result.hasPageModifications);
      setErrorMessage(null);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Reference navigation failed."
      );
      setStatus("error");
    }
  };

  const handleReset = () => {
    try {
      const result = agentSession.reset();
      const resetSucceeded = result.executionResults.every((item) => item.success);
      setMessages((current) => [
        ...current,
        createLocalActionMessage(
          resetSucceeded ? "Page changes were reset." : "Page changes could not be reset.",
          result.executionResults
        )
      ]);
      setHasPageModifications(result.hasPageModifications);
      setErrorMessage(null);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Page reset failed.");
      setStatus("error");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && settings.enterSends) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const handleSettingsChange = (next: UserSettings) => setSettings(next);
  const handleClearCurrentChat = () => {
    void deleteChatSession(sessionId).then(setHistory);
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setView("chat");
  };
  const handleClearHistory = () => {
    void clearChatHistory().then(() => setHistory([]));
  };
  const handleExport = () => {
    const text = messages.map((message) => `${message.role === "user" ? "You" : "ContextLayer"}: ${message.text}`).join("\n\n");
    void navigator.clipboard?.writeText(text);
  };
  const handleOpenSession = (session: ChatSession) => {
    setSessionId(session.url === activationTarget.ownerDocument.location.href
      ? session.id
      : crypto.randomUUID());
    setMessages(messagesFromStorage(session.messages));
    setView("chat");
  };
  const handleDeleteSession = (id: string) => {
    void deleteChatSession(id).then((next) => {
      setHistory(next);
      if (id === sessionId) {
        setMessages([]);
        setSessionId(crypto.randomUUID());
      }
    });
  };

  const suggestions = ["Summarize this page", "Key points", "Explain simply", "Translate"];

  return (
    <>
      {isOpen && (
        <section className="contextlayer-panel" aria-label="ContextLayer assistant">
          <header className="contextlayer-header">
            <div className="contextlayer-brand">
              <span className="contextlayer-brand-mark" aria-hidden="true">
                <LotusMark />
              </span>
              <div>
                <h1>ContextLayer</h1>
                <p><span aria-hidden="true" />{modeLabel}</p>
              </div>
            </div>
            <div className="contextlayer-header-actions">
              <button className="contextlayer-icon-button" type="button" aria-label="Reset page changes" title={hasPageModifications ? "Reset page changes" : "No page changes to reset"} disabled={!hasPageModifications || status === "loading"} onClick={handleReset}><RotateCcw aria-hidden="true" size={18} /></button>
              <button className={`contextlayer-icon-button${view === "history" ? " is-active" : ""}`} type="button" aria-label="History" title="History" onClick={() => setView(view === "history" ? "chat" : "history")}><Clock3 aria-hidden="true" size={18} /></button>
              <button className={`contextlayer-icon-button${view === "settings" ? " is-active" : ""}`} type="button" aria-label="Settings" title="Settings" onClick={() => setView(view === "settings" ? "chat" : "settings")}><Settings aria-hidden="true" size={18} /></button>
              <button className="contextlayer-icon-button" type="button" aria-label="Close" title="Close" onClick={() => setIsOpen(false)}><X aria-hidden="true" size={18} /></button>
            </div>
          </header>

          {view === "settings" ? <SettingsPanel settings={settings} onChange={handleSettingsChange} onExport={handleExport} onClearChat={handleClearCurrentChat} onClearHistory={handleClearHistory} /> : view === "history" ? <HistoryPanel sessions={history} activeId={sessionId} onOpen={handleOpenSession} onDelete={handleDeleteSession} onClear={handleClearHistory} /> : <>
          <div ref={messagesRef} className="contextlayer-messages" aria-live="polite">
            {connectionNotice && (
              <div className="contextlayer-error" role="status">
                <AlertCircle aria-hidden="true" size={17} />
                <p>{connectionNotice}</p>
              </div>
            )}
            {pageNotice && (
              <div className="contextlayer-page-state" role="status">
                <RotateCcw aria-hidden="true" size={15} />
                <p>{pageNotice}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="contextlayer-empty-state">
                <span className="contextlayer-empty-mark" aria-hidden="true">
                  <LotusMark />
                </span>
                <div>
                  <h2>Ready for this page</h2>
                  <p>Ask ContextLayer AI anything.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  className={`contextlayer-message contextlayer-message--${message.role}`}
                  key={message.id}
                >
                  <span className="contextlayer-message-author">
                    {message.role === "user" ? "You" : "ContextLayer"}
                  </span>
                  <p>{message.text}</p>

                  {message.references && message.references.length > 0 && (
                    <div className="contextlayer-references" aria-label="Sources">
                      <strong>Sources</strong>
                      {message.references.map((reference, index) => (
                        <button
                          type="button"
                          key={`${reference.elementId}-${index}`}
                          onClick={() => void handleReferenceClick(message.id, reference.elementId)}
                        >
                          <LocateFixed aria-hidden="true" size={14} />
                          <span>{reference.excerpt || "Open referenced content"}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {message.executionResults && message.executionResults.length > 0 && (
                    <div className="contextlayer-results" aria-label="Action results">
                      {message.executionResults.map((result, index) => {
                        const presentation = presentActionResult(result);
                        return (
                          <div
                            className={`contextlayer-result contextlayer-result--${presentation.tone}`}
                            key={`${result.type}-${index}`}
                          >
                            {presentation.tone === "success" ? (
                              <CircleCheck aria-hidden="true" size={14} />
                            ) : (
                              <CircleX aria-hidden="true" size={14} />
                            )}
                            <div>
                              <strong>{presentation.label}</strong>
                              <span>{presentation.summary}</span>
                              {presentation.detail && <span>{presentation.detail}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {message.role === "assistant" && (
                    <MessageActions
                      text={message.text}
                      canRetry={Boolean(message.retryQuery)}
                      disabled={status === "loading"}
                      onRetry={() => {
                        if (message.retryQuery) void runQuery(message.retryQuery, false);
                      }}
                    />
                  )}
                </div>
              ))
            )}

            {status === "loading" && (
              <div className="contextlayer-loading" role="status">
                <span className="contextlayer-loading-dots" aria-hidden="true">
                  <i /><i /><i />
                </span>
                <span className="contextlayer-loading-copy">{activityMessage}</span>
              </div>
            )}

            {status === "error" && errorMessage && (
              <div className="contextlayer-error" role="alert">
                <AlertCircle aria-hidden="true" size={17} />
                <p>{errorMessage}</p>
              </div>
            )}
          </div>

          <div className="contextlayer-suggestions" aria-label="Suggested prompts">
            {suggestions.map((suggestion) => (
              <button type="button" key={suggestion} onClick={() => {
                setDraft(suggestion);
                inputRef.current?.focus();
              }}>{suggestion}</button>
            ))}
          </div>

          <div className="contextlayer-reading" title={pageTitle}>
            <FileText aria-hidden="true" size={12} />
            <span>Reading:</span>
            <strong>{pageTitle}</strong>
          </div>

          <form className="contextlayer-composer" onSubmit={handleSubmit}>
            <label className="contextlayer-visually-hidden" htmlFor={inputId}>
              Message ContextLayer
            </label>
            <textarea
              id={inputId}
              ref={inputRef}
              rows={1}
              maxLength={2000}
              value={draft}
              placeholder="Message ContextLayer"
              disabled={status === "loading"}
              onChange={(event) => {
                setDraft(event.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setErrorMessage(null);
                }
              }}
              onKeyDown={handleInputKeyDown}
            />
            <button
              className="contextlayer-send-button"
              type="submit"
              aria-label="Send message"
              title="Send"
              disabled={!draft.trim() || status === "loading"}
            >
              <Send aria-hidden="true" size={18} />
            </button>
          </form>
          </>}

        </section>
      )}

      {!isOpen && (
        <button
          className="contextlayer-launcher"
          type="button"
          aria-label="Open ContextLayer assistant"
          aria-expanded={false}
          title="Open ContextLayer"
          onClick={() => setIsOpen(true)}
        >
          <LotusMark />
        </button>
      )}
    </>
  );
}
