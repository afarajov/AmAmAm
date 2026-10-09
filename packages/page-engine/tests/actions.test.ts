import { describe, expect, it, vi } from "vitest";
import { createPageEngine } from "../src/index.js";
import complexActionsHtml from "./fixtures/complex-actions-page.html?raw";

const EFFECT_CLASSES = [
  "contextlayer-engine-highlight",
  "contextlayer-engine-dim",
  "contextlayer-engine-strike",
  "contextlayer-engine-hidden",
  "contextlayer-engine-strike-container",
];

function loadFixture(): void {
  document.documentElement.innerHTML = `<head><title>Complex actions</title></head><body>${complexActionsHtml}</body>`;
  window.history.replaceState({}, "", "/actions");
}

function idForText(
  snapshot: ReturnType<ReturnType<typeof createPageEngine>["scan"]>,
  excerpt: string,
): string {
  const element = snapshot.elements.find((candidate) => candidate.text.includes(excerpt));
  if (!element) throw new Error(`Fixture element not found: ${excerpt}`);
  return element.id;
}

describe("Page Engine action execution", () => {
  it("highlights multiple unique targets and clears only the selected target", () => {
    loadFixture();
    const first = document.querySelector("#target-highlight")! as HTMLElement;
    const second = document.querySelector("#target-dim")! as HTMLElement;
    const originalFirstStyle = first.getAttribute("style");
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const firstId = idForText(snapshot, "deterministic highlighting");
    const secondId = idForText(snapshot, "temporarily dimmed");

    const result = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [firstId, secondId, firstId] }],
    });

    expect(result[0]).toEqual({
      type: "HIGHLIGHT",
      success: true,
      affectedElementIds: [firstId, secondId],
      failures: [],
    });
    expect(first.classList.contains("contextlayer-engine-highlight")).toBe(true);
    expect(second.classList.contains("contextlayer-engine-highlight")).toBe(true);
    expect(first.getAttribute("style")).toBe(originalFirstStyle);

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [firstId] }],
    });
    expect(first.classList.toString().match(/contextlayer-engine-highlight/g)).toHaveLength(1);

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "CLEAR_EFFECT", targetElementIds: [firstId] }],
    });
    expect(first.classList.contains("contextlayer-engine-highlight")).toBe(false);
    expect(second.classList.contains("contextlayer-engine-highlight")).toBe(true);
    expect(first.classList.contains("website-paragraph")).toBe(true);
    expect(first.getAttribute("style")).toBe(originalFirstStyle);
    engine.dispose();
  });

  it("restores DIM, STRIKE, and HIDE with CLEAR_EFFECT", () => {
    loadFixture();
    const dim = document.querySelector("#target-dim")! as HTMLElement;
    const strike = document.querySelector("#target-strike")! as HTMLElement;
    const hidden = document.querySelector("#target-hide")! as HTMLElement;
    const originalStyles = new Map([
      [dim, dim.getAttribute("style")],
      [strike, strike.getAttribute("style")],
      [hidden, hidden.getAttribute("style")],
    ]);
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const dimId = idForText(snapshot, "temporarily dimmed");
    const strikeId = idForText(snapshot, "legacy recommendation");
    const hideId = idForText(snapshot, "optional paragraph");

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "DIM", targetElementIds: [dimId, dimId] },
        { type: "DIM", targetElementIds: [dimId] },
        { type: "STRIKE", targetElementIds: [strikeId, strikeId] },
        { type: "STRIKE", targetElementIds: [strikeId] },
        { type: "HIDE", targetElementIds: [hideId, hideId] },
        { type: "HIDE", targetElementIds: [hideId] },
      ],
    });
    expect(getComputedStyle(dim).opacity).toBe("0.28");
    expect(strike.querySelectorAll("[data-contextlayer-strike-overlay]")).toHaveLength(1);
    expect(getComputedStyle(hidden).display).toBe("none");

    const cleared = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "CLEAR_EFFECT", targetElementIds: [dimId] },
        { type: "CLEAR_EFFECT", targetElementIds: [dimId] },
        { type: "CLEAR_EFFECT", targetElementIds: [strikeId] },
        { type: "CLEAR_EFFECT", targetElementIds: [strikeId] },
        { type: "CLEAR_EFFECT", targetElementIds: [hideId] },
        { type: "CLEAR_EFFECT", targetElementIds: [hideId] },
      ],
    });
    expect(cleared.every((result) => result.success)).toBe(true);
    expect(getComputedStyle(dim).opacity).toBe("0.85");
    expect(strike.querySelector("[data-contextlayer-strike-overlay]")).toBeNull();
    expect(getComputedStyle(hidden).display).toBe("block");
    expect(dim.getAttribute("style")).toBe(originalStyles.get(dim));
    expect(strike.getAttribute("style")).toBe(originalStyles.get(strike));
    expect(hidden.getAttribute("style")).toBe(originalStyles.get(hidden));
    expect(strike.classList.contains("legacy-card")).toBe(true);
    engine.dispose();
  });

  it("restores several different effects and safely repeats RESTORE_ALL", () => {
    loadFixture();
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const ids = {
      highlight: idForText(snapshot, "deterministic highlighting"),
      dim: idForText(snapshot, "temporarily dimmed"),
      strike: idForText(snapshot, "legacy recommendation"),
      hide: idForText(snapshot, "optional paragraph"),
    };

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "HIGHLIGHT", targetElementIds: [ids.highlight] },
        { type: "DIM", targetElementIds: [ids.dim] },
        { type: "STRIKE", targetElementIds: [ids.strike] },
        { type: "HIDE", targetElementIds: [ids.hide] },
      ],
    });

    const restored = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "RESTORE_ALL" }, { type: "RESTORE_ALL" }],
    });
    expect(restored[0]?.success).toBe(true);
    expect(new Set(restored[0]?.affectedElementIds)).toEqual(new Set(Object.values(ids)));
    expect(restored[1]).toEqual({
      type: "RESTORE_ALL",
      success: true,
      affectedElementIds: [],
      failures: [],
    });
    for (const className of EFFECT_CLASSES) {
      expect(document.querySelector(`.${className}`)).toBeNull();
    }
    expect(document.querySelector("[data-contextlayer-strike-overlay]")).toBeNull();
    expect(document.querySelector("[data-contextlayer-engine-styles]")).toBeNull();
    engine.dispose();
  });

  it("reports partial success per target and deduplicates target IDs", () => {
    loadFixture();
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const validId = idForText(snapshot, "deterministic highlighting");
    const detachedId = idForText(snapshot, "temporarily dimmed");
    document.querySelector("#target-dim")!.remove();

    const result = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{
        type: "HIGHLIGHT",
        targetElementIds: [validId, detachedId, "node-99999", validId],
      }],
    })[0]!;

    expect(result.success).toBe(false);
    expect(result.affectedElementIds).toEqual([validId]);
    expect(result.failures.map((failure) => failure.code)).toEqual([
      "DETACHED_NODE",
      "UNKNOWN_ID",
    ]);
    expect(document.querySelector("#target-highlight")?.classList.contains("contextlayer-engine-highlight")).toBe(true);
    engine.dispose();
  });

  it("rejects an old pageId before applying any target", () => {
    loadFixture();
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const id = idForText(snapshot, "deterministic highlighting");

    const result = engine.executeActions({
      pageId: "page-from-another-document",
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [id] }],
    });
    expect(result[0]?.failures[0]?.code).toBe("STALE_SNAPSHOT");
    expect(document.querySelector("#target-highlight")?.classList.contains("contextlayer-engine-highlight")).toBe(false);
    engine.dispose();
  });

  it("rejects queued page mutations atomically before applying actions", () => {
    loadFixture();
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const firstId = idForText(snapshot, "deterministic highlighting");
    const secondId = idForText(snapshot, "temporarily dimmed");
    const inserted = document.createElement("p");
    inserted.textContent = "Content inserted immediately before the old action result arrived.";
    document.querySelector("article")!.append(inserted);

    const results = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "HIGHLIGHT", targetElementIds: [firstId] },
        { type: "DIM", targetElementIds: [secondId] },
      ],
    });
    expect(results.map((result) => result.failures[0]?.code)).toEqual([
      "STALE_SNAPSHOT",
      "STALE_SNAPSHOT",
    ]);
    expect(document.querySelector("#target-highlight")?.classList.contains("contextlayer-engine-highlight")).toBe(false);
    expect(document.querySelector("#target-dim")?.classList.contains("contextlayer-engine-dim")).toBe(false);
    engine.dispose();
  });

  it("accounts for a fixed header with one scroll and restores scroll-margin", () => {
    loadFixture();
    const header = document.querySelector("#fixed-header")!;
    const target = document.querySelector("#target-highlight")! as HTMLElement;
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 1200,
      bottom: 64,
      left: 0,
      width: 1200,
      height: 64,
      toJSON: () => ({}),
    });
    let marginDuringScroll = "";
    target.scrollIntoView = vi.fn(() => {
      marginDuringScroll = target.style.getPropertyValue("scroll-margin-top");
    });
    const originalStyle = target.getAttribute("style");
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const id = idForText(snapshot, "deterministic highlighting");

    const result = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "SCROLL_TO", targetElementIds: [id, id] }],
    });
    expect(result[0]?.affectedElementIds).toEqual([id]);
    expect(target.scrollIntoView).toHaveBeenCalledOnce();
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    expect(marginDuringScroll).toBe("72px");
    expect(target.getAttribute("style")).toBe(originalStyle);
    engine.dispose();
  });

  it("keeps extension UI and engine effects out of snapshot content", () => {
    loadFixture();
    const engine = createPageEngine(document, { observeMutations: false });
    const before = engine.scan();
    const id = idForText(before, "deterministic highlighting");
    engine.executeActions({
      pageId: before.pageId,
      snapshotVersion: before.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [id] }],
    });
    const after = engine.scan();

    expect(after.elements.map((element) => element.text)).toEqual(
      before.elements.map((element) => element.text),
    );
    expect(after.snapshotVersion).toBe(before.snapshotVersion);
    expect(after.elements.some((element) => element.text.includes("Extension controls"))).toBe(false);
    engine.dispose();
  });
});
