import {
  AlertCircle,
  CircleCheck,
  CircleX,
  LocateFixed,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { ActionExecutionResult, AgentResponse } from "@contextlayer/shared";

import type {
  AgentSession,
  AgentSessionProgress
} from "../integration/agentSession";
import type { ChatMessage, RequestStatus } from "./types";

interface AssistantWidgetProps {
  activationTarget: HTMLElement;
  activationEvent: string;
  agentSession: AgentSession;
  modeLabel: string;
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
  executionResults: ActionExecutionResult[]
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
  modeLabel
}: AssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPageModifications, setHasPageModifications] = useState(false);
  const [activityMessage, setActivityMessage] = useState("Waiting for response…");
  const [pageNotice, setPageNotice] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const togglePanel = () => setIsOpen((current) => !current);
    activationTarget.addEventListener(activationEvent, togglePanel);
    return () => activationTarget.removeEventListener(activationEvent, togglePanel);
  }, [activationEvent, activationTarget]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

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
      agentSession.invalidatePage();
      setMessages([]);
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
  }, [activationTarget, agentSession]);

  const submitMessage = async () => {
    const query = draft.trim();
    if (!query || status === "loading") return;

    setMessages((current) => [...current, createMessage(query, "user")]);
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
      } = await agentSession.submit(query, {
        onProgress: (progress) => setActivityMessage(PROGRESS_MESSAGES[progress])
      });
      setMessages((current) => [
        ...current,
        createAssistantMessage(response, executionResults)
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
    }
  };

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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  return (
    <>
      {isOpen && (
        <section className="contextlayer-panel" aria-label="ContextLayer assistant">
          <header className="contextlayer-header">
            <div className="contextlayer-brand">
              <span className="contextlayer-brand-mark" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.2} />
              </span>
              <div>
                <h1>ContextLayer</h1>
                <p><span aria-hidden="true" />{modeLabel}</p>
              </div>
            </div>
            <button
              className="contextlayer-icon-button"
              type="button"
              aria-label="Reset page changes"
              title={hasPageModifications ? "Reset page changes" : "No page changes to reset"}
              disabled={!hasPageModifications || status === "loading"}
              onClick={handleReset}
            >
              <RotateCcw aria-hidden="true" size={18} />
            </button>
          </header>

          <div ref={messagesRef} className="contextlayer-messages" aria-live="polite">
            {pageNotice && (
              <div className="contextlayer-page-state" role="status">
                <RotateCcw aria-hidden="true" size={15} />
                <p>{pageNotice}</p>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="contextlayer-empty-state">
                <span className="contextlayer-empty-mark" aria-hidden="true">
                  <MessageCircle size={30} strokeWidth={1.7} />
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
                          <span>{reference.excerpt || reference.elementId}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {message.executionResults && message.executionResults.length > 0 && (
                    <div className="contextlayer-results" aria-label="Action results">
                      {message.executionResults.map((result, index) => (
                        <div
                          className={`contextlayer-result contextlayer-result--${result.success ? "success" : "failure"}`}
                          key={`${result.type}-${index}`}
                        >
                          {result.success ? (
                            <CircleCheck aria-hidden="true" size={14} />
                          ) : (
                            <CircleX aria-hidden="true" size={14} />
                          )}
                          <div>
                            <strong>{result.type.replaceAll("_", " ")}</strong>
                            <span>
                              {result.success
                                ? `${result.affectedElementIds.length} element${result.affectedElementIds.length === 1 ? "" : "s"} affected`
                                : [
                                    result.affectedElementIds.length > 0
                                      ? `${result.affectedElementIds.length} element${result.affectedElementIds.length === 1 ? "" : "s"} affected.`
                                      : "",
                                    result.failures.map((failure) => failure.message).join(" ")
                                  ].filter(Boolean).join(" ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
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
          <Sparkles aria-hidden="true" size={22} strokeWidth={2} />
        </button>
      )}
    </>
  );
}
