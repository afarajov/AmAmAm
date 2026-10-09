import {
  AlertCircle,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X
} from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import type { ChatMessage, RequestStatus } from "./types";

interface AssistantWidgetProps {
  activationTarget: HTMLElement;
  activationEvent: string;
}

const UNAVAILABLE_MESSAGE =
  "The agent connection is not configured yet. Your message was not sent.";

function createMessage(text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    text
  };
}

export function AssistantWidget({
  activationTarget,
  activationEvent
}: AssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const openPanel = () => setIsOpen(true);
    activationTarget.addEventListener(activationEvent, openPanel);
    return () => activationTarget.removeEventListener(activationEvent, openPanel);
  }, [activationEvent, activationTarget]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    activationTarget.ownerDocument.addEventListener("keydown", closeOnEscape);
    return () => activationTarget.ownerDocument.removeEventListener("keydown", closeOnEscape);
  }, [activationTarget]);

  const submitMessage = () => {
    const query = draft.trim();
    if (!query || status === "loading") return;

    setMessages((current) => [...current, createMessage(query)]);
    setDraft("");
    setStatus("error");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
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
                <p><span aria-hidden="true" />Page session</p>
              </div>
            </div>
            <div className="contextlayer-header-actions">
              <button
                className="contextlayer-icon-button"
                type="button"
                aria-label="Reset page changes"
                title="No page changes to reset"
                disabled
              >
                <RotateCcw aria-hidden="true" size={18} />
              </button>
              <button
                className="contextlayer-icon-button"
                type="button"
                aria-label="Close assistant"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                <X aria-hidden="true" size={19} />
              </button>
            </div>
          </header>

          <div className="contextlayer-messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="contextlayer-empty-state">
                <MessageCircle aria-hidden="true" size={28} strokeWidth={1.7} />
                <p>No messages yet</p>
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

            {status === "error" && (
              <div className="contextlayer-error" role="alert">
                <AlertCircle aria-hidden="true" size={17} />
                <p>{UNAVAILABLE_MESSAGE}</p>
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
              onChange={(event) => {
                setDraft(event.target.value);
                if (status === "error") setStatus("idle");
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

      <button
        className="contextlayer-launcher"
        type="button"
        aria-label={isOpen ? "Close ContextLayer assistant" : "Open ContextLayer assistant"}
        aria-expanded={isOpen}
        title={isOpen ? "Close ContextLayer" : "Open ContextLayer"}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? (
          <X aria-hidden="true" size={22} strokeWidth={2} />
        ) : (
          <Sparkles aria-hidden="true" size={22} strokeWidth={2} />
        )}
      </button>
    </>
  );
}
