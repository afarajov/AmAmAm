import {
  Check,
  Clipboard,
  RefreshCw,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { useState } from "react";

import type { ChatMessage } from "./types";

const ACCENTS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#ec4899"];

type SettingsTab = "appearance" | "personalization" | "api" | "data";

export function SettingsPanel() {
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [copied, setCopied] = useState(false);

  return (
    <section className="contextlayer-settings" aria-label="Settings">
      <nav className="contextlayer-tabs" aria-label="Settings sections">
        {([
          ["appearance", "Appearance"],
          ["personalization", "Personalization"],
          ["api", "API"],
          ["data", "Data"]
        ] as const).map(([value, label]) => (
          <button
            className={tab === value ? "is-active" : ""}
            type="button"
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="contextlayer-settings-content">
        {tab === "appearance" && (
          <>
            <SettingRow label="Interface language">
              <select className="contextlayer-input" defaultValue="en">
                <option value="en">English</option>
                <option value="az">Azərbaycan</option>
                <option value="ru">Русский</option>
              </select>
            </SettingRow>
            <SettingRow label="Background">
              <Segmented options={["Light", "Dark"]} active="Dark" />
            </SettingRow>
            <SettingRow label="Accent color" hint="Pick a preset or choose any color" column>
              <div className="contextlayer-swatches">
                {ACCENTS.map((color, index) => (
                  <button
                    className={index === 0 ? "is-active" : ""}
                    type="button"
                    key={color}
                    aria-label={`Accent ${color}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label className="contextlayer-custom-color">
                  <span />Custom
                  <input type="color" defaultValue="#f97316" aria-label="Custom accent color" />
                </label>
              </div>
            </SettingRow>
            <SettingRow label="Text size"><Segmented options={["S", "M", "L"]} active="M" /></SettingRow>
            <SettingRow label="Button size"><Segmented options={["S", "M", "L"]} active="M" /></SettingRow>
            <SettingRow label="Button position"><Segmented options={["Left", "Right"]} active="Right" /></SettingRow>
          </>
        )}

        {tab === "personalization" && (
          <>
            <SettingRow label="Response style" column>
              <div className="contextlayer-option-cards">
                {[
                  ["Normal", "Balanced, as usual"], ["Warm", "Kind and supportive"],
                  ["Gentle", "Soft and calm"], ["Friendly", "Casual, like a friend"],
                  ["Professional", "Clear and formal"], ["Direct", "Short, to the point"]
                ].map(([label, hint], index) => (
                  <button className={index === 0 ? "is-active" : ""} type="button" key={label}>
                    <b>{label}</b><small>{hint}</small>
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Emoji"><Segmented options={["None", "A few", "Lots"]} active="A few" /></SettingRow>
            <SettingRow label="Answer length"><Segmented options={["Short", "Normal", "Detailed"]} active="Normal" /></SettingRow>
            <ToggleRow label="Page context" hint="Read the text of the open page" defaultChecked />
            <ToggleRow label="Enter sends" hint="Shift+Enter for a new line" defaultChecked />
            <ToggleRow label="Save history" hint="Separately for each page" defaultChecked />
            <SettingRow label="Custom instructions" column>
              <textarea className="contextlayer-input contextlayer-settings-textarea" placeholder="e.g. Always explain simply" />
            </SettingRow>
          </>
        )}

        {tab === "api" && (
          <>
            <SettingRow label="Provider"><span className="contextlayer-keycap">ChatGPT</span></SettingRow>
            <SettingRow label="Model"><span className="contextlayer-keycap">GPT-5.5</span></SettingRow>
            <SettingRow label="API key" hint="Stored only in this browser" column>
              <input className="contextlayer-input contextlayer-wide-input" type="password" placeholder="sk-..." />
            </SettingRow>
          </>
        )}

        {tab === "data" && (
          <>
            <SettingRow label="Shortcut" hint="Open or close chat from anywhere">
              <span className="contextlayer-keycap">Ctrl/⌘ + Shift + K</span>
            </SettingRow>
            <SettingRow label="Disabled sites" hint="The button is hidden on these sites" column>
              <textarea className="contextlayer-input contextlayer-settings-textarea" placeholder="e.g. mybank.com, mail.google.com" />
            </SettingRow>
            <SettingRow label="Export chat" hint="Copy as text">
              <button className="contextlayer-secondary-button" type="button" onClick={() => setCopied(true)}>
                {copied ? "Copied" : "Copy"}
              </button>
            </SettingRow>
            <SettingRow label="Clear chat"><button className="contextlayer-secondary-button" type="button">Clear</button></SettingRow>
            <SettingRow label="Reset settings" hint="Restore defaults">
              <button className="contextlayer-secondary-button contextlayer-secondary-button--danger" type="button">Reset</button>
            </SettingRow>
            <p className="contextlayer-version">ContextLayer v1.0</p>
          </>
        )}
      </div>
    </section>
  );
}

export function HistoryPanel({ messages }: { messages: ChatMessage[] }) {
  const userMessages = messages.filter((message) => message.role === "user");
  return (
    <section className="contextlayer-history" aria-label="Chat history">
      {userMessages.length === 0 ? (
        <p>No saved chats yet</p>
      ) : userMessages.map((message) => (
        <button type="button" key={message.id}>{message.text}</button>
      ))}
    </section>
  );
}

export function MessageActions({ text }: { text: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="contextlayer-message-actions">
      <button type="button" title="Copy" aria-label="Copy answer" onClick={() => void copy()}>
        {copied ? <Check size={14} /> : <Clipboard size={14} />}
      </button>
      <button className={rating === "up" ? "is-active" : ""} type="button" title="Good answer" aria-label="Good answer" onClick={() => setRating(rating === "up" ? null : "up")}><ThumbsUp size={14} /></button>
      <button className={rating === "down" ? "is-active" : ""} type="button" title="Bad answer" aria-label="Bad answer" onClick={() => setRating(rating === "down" ? null : "down")}><ThumbsDown size={14} /></button>
      <button type="button" title="Try again" aria-label="Try answer again"><RefreshCw size={14} /></button>
    </div>
  );
}

function SettingRow({ label, hint, column = false, children }: {
  label: string;
  hint?: string;
  column?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`contextlayer-setting-row${column ? " contextlayer-setting-row--column" : ""}`}>
      <div><span>{label}</span>{hint && <small>{hint}</small>}</div>
      {children}
    </div>
  );
}

function Segmented({ options, active }: { options: string[]; active: string }) {
  return <div className="contextlayer-segmented">{options.map((option) => <button className={option === active ? "is-active" : ""} type="button" key={option}>{option}</button>)}</div>;
}

function ToggleRow({ label, hint, defaultChecked }: { label: string; hint: string; defaultChecked?: boolean }) {
  return <SettingRow label={label} hint={hint}><input className="contextlayer-toggle" type="checkbox" defaultChecked={defaultChecked} /></SettingRow>;
}
