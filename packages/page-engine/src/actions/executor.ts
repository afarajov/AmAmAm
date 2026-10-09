import type {
  ActionExecutionResult,
  ActionFailure,
  AgentAction,
  AgentActionType,
} from "@contextlayer/shared";
import type { ElementMapper } from "../mapping/element-mapper.js";

const CLASS = {
  highlight: "contextlayer-engine-highlight",
  dim: "contextlayer-engine-dim",
  strike: "contextlayer-engine-strike",
  hidden: "contextlayer-engine-hidden",
} as const;

const STYLE_ATTRIBUTE = "data-contextlayer-engine-styles";
const OVERLAY_ATTRIBUTE = "data-contextlayer-strike-overlay";
type Effect = keyof typeof CLASS;

interface EffectRecord {
  effects: Set<Effect>;
  overlay?: HTMLElement;
  originalPosition?: { value: string; priority: string };
}

export class ActionExecutor {
  private readonly records = new Map<Element, EffectRecord>();

  constructor(
    private readonly document: Document,
    private readonly mapper: ElementMapper,
  ) {}

  execute(action: AgentAction): ActionExecutionResult {
    if (action.type === "RESTORE_ALL") return this.restorePage();

    const type = action.type as AgentActionType;
    if (!isSupportedAction(type)) {
      return failureResult(type, undefined, "UNSUPPORTED_ACTION", `Unsupported action: ${String(type)}`);
    }

    const affectedElementIds: string[] = [];
    const failures: ActionFailure[] = [];
    const ids = [...new Set(action.targetElementIds)];

    for (const id of ids) {
      const wasKnown = this.mapper.hasId(id);
      const element = this.mapper.resolve(id);
      if (!element) {
        failures.push({
          elementId: id,
          code: wasKnown ? "DETACHED_NODE" : "UNKNOWN_ID",
          message: wasKnown
            ? `The mapped element is no longer attached: ${id}`
            : `Unknown element ID: ${id}`,
        });
        continue;
      }

      try {
        if (type === "HIDE" && !isSafeToHide(element, this.document)) {
          failures.push({ elementId: id, code: "UNSAFE_TARGET", message: "Refusing to hide a page root or application root." });
          continue;
        }

        this.apply(type, element);
        affectedElementIds.push(id);
      } catch (error) {
        failures.push({
          elementId: id,
          code: "EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "DOM action failed.",
        });
      }
    }

    return { type, success: failures.length === 0, affectedElementIds, failures };
  }

  restorePage(): ActionExecutionResult {
    const affectedElementIds: string[] = [];
    for (const element of [...this.records.keys()]) {
      const id = this.mapper.getId(element);
      this.clearElement(element);
      if (id) affectedElementIds.push(id);
    }
    this.document.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
    return { type: "RESTORE_ALL", success: true, affectedElementIds, failures: [] };
  }

  private apply(type: Exclude<AgentActionType, "RESTORE_ALL">, element: Element): void {
    if (type === "SCROLL_TO") {
      if (!("scrollIntoView" in element) || typeof element.scrollIntoView !== "function") {
        throw new Error("scrollIntoView is not supported by this document.");
      }
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      return;
    }
    if (type === "CLEAR_EFFECT") {
      this.clearElement(element);
      return;
    }

    this.ensureStyles();
    const effect = actionToEffect(type);
    const record = this.records.get(element) ?? { effects: new Set<Effect>() };
    if (record.effects.has(effect)) return;

    element.classList.add(CLASS[effect]);
    record.effects.add(effect);
    if (effect === "strike" && shouldUseOverlay(element)) {
      this.addStrikeOverlay(element, record);
    }
    this.records.set(element, record);
  }

  private addStrikeOverlay(element: Element, record: EffectRecord): void {
    if (!(element instanceof this.document.defaultView!.HTMLElement) || record.overlay) return;
    const style = this.document.defaultView!.getComputedStyle(element);
    if (style.position === "static") {
      record.originalPosition = {
        value: element.style.getPropertyValue("position"),
        priority: element.style.getPropertyPriority("position"),
      };
      element.style.setProperty("position", "relative");
    }

    const overlay = this.document.createElement("span");
    overlay.setAttribute(OVERLAY_ATTRIBUTE, "");
    overlay.setAttribute("aria-hidden", "true");
    element.append(overlay);
    record.overlay = overlay;
  }

  private clearElement(element: Element): void {
    const record = this.records.get(element);
    if (!record) return;

    for (const effect of record.effects) element.classList.remove(CLASS[effect]);
    record.overlay?.remove();
    if (record.originalPosition && element instanceof this.document.defaultView!.HTMLElement) {
      const { value, priority } = record.originalPosition;
      if (value) element.style.setProperty("position", value, priority);
      else element.style.removeProperty("position");
    }
    this.records.delete(element);
  }

  private ensureStyles(): void {
    if (this.document.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
    const style = this.document.createElement("style");
    style.setAttribute(STYLE_ATTRIBUTE, "");
    style.textContent = `
      .${CLASS.highlight} {
        background-color: rgba(255, 224, 64, 0.42) !important;
        outline: 3px solid #ffb300 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(255, 179, 0, 0.2) !important;
      }
      .${CLASS.dim} { opacity: 0.28 !important; }
      .${CLASS.strike} { text-decoration: line-through 3px rgba(210, 40, 40, 0.85) !important; }
      .${CLASS.hidden} { display: none !important; }
      [${OVERLAY_ATTRIBUTE}] {
        position: absolute !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        pointer-events: none !important;
        background:
          linear-gradient(to top right, transparent 48.5%, rgba(210, 40, 40, 0.88) 49%, rgba(210, 40, 40, 0.88) 51%, transparent 51.5%),
          linear-gradient(to bottom right, transparent 48.5%, rgba(210, 40, 40, 0.88) 49%, rgba(210, 40, 40, 0.88) 51%, transparent 51.5%) !important;
      }
    `;
    (this.document.head ?? this.document.documentElement).append(style);
  }
}

function actionToEffect(type: "HIGHLIGHT" | "DIM" | "STRIKE" | "HIDE"): Effect {
  if (type === "HIGHLIGHT") return "highlight";
  if (type === "DIM") return "dim";
  if (type === "STRIKE") return "strike";
  return "hidden";
}

function isSupportedAction(type: AgentActionType): type is Exclude<AgentActionType, "RESTORE_ALL"> {
  return ["SCROLL_TO", "HIGHLIGHT", "DIM", "STRIKE", "HIDE", "CLEAR_EFFECT"].includes(type);
}

function isSafeToHide(element: Element, document: Document): boolean {
  if (element === document.documentElement || element === document.body) return false;
  const tag = element.tagName.toLowerCase();
  return tag !== "html" && tag !== "body" && tag !== "main";
}

function shouldUseOverlay(element: Element): boolean {
  return ["article", "section", "div", "li", "tr"].includes(element.tagName.toLowerCase());
}

function failureResult(
  type: AgentActionType,
  elementId: string | undefined,
  code: ActionFailure["code"],
  message: string,
): ActionExecutionResult {
  return { type, success: false, affectedElementIds: [], failures: [{ elementId, code, message }] };
}
