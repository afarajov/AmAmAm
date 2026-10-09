import {
  AlertCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { AgentSession } from "../integration/agentSession";
import type { ChatMessage, RequestStatus } from "./types";

interface AssistantWidgetProps {
  activationTarget: HTMLElement;
  activationEvent: string;
  agentSession: AgentSession;
  modeLabel: string;
}

function createMessage(text: string, role: ChatMessage["role"]): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text
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

  const submitMessage = async () => {
    const query = draft.trim();
    if (!query || status === "loading") return;

    setMessages((current) => [...current, createMessage(query, "user")]);
    setDraft("");
    setErrorMessage(null);
    setStatus("loading");

    try {
      const { response } = await agentSession.submit(query);
      setMessages((current) => [
        ...current,
        createMessage(response.message, "assistant")
      ]);
      setStatus("idle");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The agent request failed unexpectedly."
      );
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
              title="No page changes to reset"
              disabled
            >
              <RotateCcw aria-hidden="true" size={18} />
            </button>
          </header>

          <div ref={messagesRef} className="contextlayer-messages" aria-live="polite">
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
                  <span>{message.role === "user" ? "You" : "ContextLayer"}</span>
                  <p>{message.text}</p>
                </div>
              ))
            )}

            {status === "loading" && (
              <div className="contextlayer-loading" role="status">
                <span /><span /><span />
                <span className="contextlayer-visually-hidden">Waiting for response</span>
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
