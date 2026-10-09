import {
  Check,
  Clipboard,
  RefreshCw,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { useState } from "react";

import type { ChatMessage } from "./types";

export function HistoryPanel({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <section className="contextlayer-history" aria-label="Chat history">
        <p>No messages in this page session yet.</p>
      </section>
    );
  }

  return (
    <section className="contextlayer-history" aria-label="Chat history">
      {messages.map((message) => (
        <article
          className={`contextlayer-history-item contextlayer-history-item--${message.role}`}
          key={message.id}
        >
          <strong>{message.role === "user" ? "You" : "ContextLayer"}</strong>
          <p>{message.text}</p>
        </article>
      ))}
    </section>
  );
}

export function MessageActions({
  text,
  canRetry,
  disabled,
  onRetry
}: {
  text: string;
  canRetry: boolean;
  disabled: boolean;
  onRetry: () => void;
}) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="contextlayer-message-actions">
      <button type="button" title="Copy" aria-label="Copy answer" onClick={() => void copy()}>
        {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
      </button>
      <button
        className={rating === "up" ? "is-active" : ""}
        type="button"
        title="Good answer"
        aria-label="Good answer"
        aria-pressed={rating === "up"}
        onClick={() => setRating(rating === "up" ? null : "up")}
      >
        <ThumbsUp aria-hidden="true" size={14} />
      </button>
      <button
        className={rating === "down" ? "is-active" : ""}
        type="button"
        title="Bad answer"
        aria-label="Bad answer"
        aria-pressed={rating === "down"}
        onClick={() => setRating(rating === "down" ? null : "down")}
      >
        <ThumbsDown aria-hidden="true" size={14} />
      </button>
      {canRetry && (
        <button
          type="button"
          title="Try again"
          aria-label="Try answer again"
          disabled={disabled}
          onClick={onRetry}
        >
          <RefreshCw aria-hidden="true" size={14} />
        </button>
      )}
    </div>
  );
}
