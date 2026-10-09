import React from "react";

import type { UserSettings } from "../storage/userData";
import { DEFAULT_SETTINGS } from "../storage/userData";

const ACCENTS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#eab308", "#ec4899"];
type SettingsTab = "appearance" | "personalization" | "data";

export function SettingsPanel({
  settings,
  onChange,
  onExport,
  onClearChat,
  onClearHistory
}: {
  settings: UserSettings;
  onChange: (settings: UserSettings) => void;
  onExport: () => void;
  onClearChat: () => void;
  onClearHistory: () => void;
}) {
  const [tab, setTab] = React.useState<SettingsTab>("appearance");
  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <section className="contextlayer-settings" aria-label="Settings">
      <nav className="contextlayer-tabs" aria-label="Settings sections">
        {(["appearance", "personalization", "data"] as const).map((value) => (
          <button className={tab === value ? "is-active" : ""} type="button" key={value} onClick={() => setTab(value)}>
            {value === "appearance" ? "Appearance" : value === "personalization" ? "Personalization" : "Data"}
          </button>
        ))}
      </nav>

      <div className="contextlayer-settings-content">
        {tab === "appearance" && <>
          <SettingRow label="Theme"><Segmented values={["system", "light", "dark"]} active={settings.theme} onSelect={(value) => update("theme", value as UserSettings["theme"])} /></SettingRow>
          <SettingRow label="Accent color" hint="Applied instantly to the icon and controls" column>
            <div className="contextlayer-swatches">
              {ACCENTS.map((color) => <button className={settings.accentColor === color ? "is-active" : ""} type="button" key={color} aria-label={`Accent ${color}`} style={{ backgroundColor: color }} onClick={() => update("accentColor", color)} />)}
              <label className="contextlayer-custom-color"><span />Custom<input type="color" value={settings.accentColor} aria-label="Custom accent color" onChange={(event) => update("accentColor", event.target.value)} /></label>
            </div>
          </SettingRow>
          <SettingRow label="Text size"><Segmented values={["small", "medium", "large"]} active={settings.textSize} onSelect={(value) => update("textSize", value as UserSettings["textSize"])} /></SettingRow>
          <SettingRow label="Button size"><Segmented values={["small", "medium", "large"]} active={settings.buttonSize} onSelect={(value) => update("buttonSize", value as UserSettings["buttonSize"])} /></SettingRow>
          <SettingRow label="Button position"><Segmented values={["left", "right"]} active={settings.buttonPosition} onSelect={(value) => update("buttonPosition", value as UserSettings["buttonPosition"])} /></SettingRow>
        </>}

        {tab === "personalization" && <>
          <SettingRow label="Response style" column>
            <div className="contextlayer-option-cards">
              {(["normal", "warm", "friendly", "professional", "direct"] as const).map((value) => <button className={settings.responseStyle === value ? "is-active" : ""} type="button" key={value} onClick={() => update("responseStyle", value)}><b>{capitalize(value)}</b></button>)}
            </div>
          </SettingRow>
          <SettingRow label="Emoji"><Segmented values={["none", "few", "lots"]} active={settings.emoji} onSelect={(value) => update("emoji", value as UserSettings["emoji"])} /></SettingRow>
          <SettingRow label="Answer length"><Segmented values={["short", "normal", "detailed"]} active={settings.answerLength} onSelect={(value) => update("answerLength", value as UserSettings["answerLength"])} /></SettingRow>
          <ToggleRow label="Enter sends" hint="Shift+Enter always creates a new line" checked={settings.enterSends} onChange={(value) => update("enterSends", value)} />
          <ToggleRow label="Save history" hint="Stored locally in this browser" checked={settings.saveHistory} onChange={(value) => update("saveHistory", value)} />
          <SettingRow label="Custom instructions" column><textarea className="contextlayer-input contextlayer-settings-textarea" value={settings.customInstructions} maxLength={500} placeholder="e.g. Always explain simply" onChange={(event) => update("customInstructions", event.target.value)} /></SettingRow>
        </>}

        {tab === "data" && <>
          <SettingRow label="Export current chat" hint="Copy as text"><button className="contextlayer-secondary-button" type="button" onClick={onExport}>Copy</button></SettingRow>
          <SettingRow label="Clear current chat"><button className="contextlayer-secondary-button" type="button" onClick={onClearChat}>Clear</button></SettingRow>
          <SettingRow label="Clear all history"><button className="contextlayer-secondary-button contextlayer-secondary-button--danger" type="button" onClick={onClearHistory}>Clear all</button></SettingRow>
          <SettingRow label="Reset settings"><button className="contextlayer-secondary-button" type="button" onClick={() => onChange(DEFAULT_SETTINGS)}>Reset</button></SettingRow>
          <p className="contextlayer-version">ContextLayer v0.1.0 · Data stays in this browser</p>
        </>}
      </div>
    </section>
  );
}

function SettingRow({ label, hint, column = false, children }: { label: string; hint?: string; column?: boolean; children: React.ReactNode }) {
  return <div className={`contextlayer-setting-row${column ? " contextlayer-setting-row--column" : ""}`}><div><span>{label}</span>{hint && <small>{hint}</small>}</div>{children}</div>;
}

function Segmented({ values, active, onSelect }: { values: string[]; active: string; onSelect: (value: string) => void }) {
  return <div className="contextlayer-segmented">{values.map((value) => <button className={value === active ? "is-active" : ""} type="button" key={value} onClick={() => onSelect(value)}>{capitalize(value)}</button>)}</div>;
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <SettingRow label={label} hint={hint}><input className="contextlayer-toggle" type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} /></SettingRow>;
}

function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
