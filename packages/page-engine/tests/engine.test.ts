import { describe, expect, it, vi } from "vitest";
import { createPageEngine } from "../src/index.js";
import semanticPageHtml from "./fixtures/semantic-page.html?raw";

function load(html: string): void {
  document.documentElement.innerHTML = `<head><title>Fixture page</title></head><body>${html}</body>`;
  window.history.replaceState({}, "", "/fixture");
}

describe("SemanticPageEngine", () => {
  it("extracts meaningful content, assigns IDs, and excludes sensitive or hidden data", () => {
    load(semanticPageHtml);
    const snapshot = createPageEngine(document).scan();

    expect(snapshot.contractVersion).toBe("1");
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.elements.map((element) => element.kind)).toEqual([
      "heading",
      "paragraph",
      "link",
    ]);
    expect(snapshot.elements.every((element) => /^node-\d{5}$/.test(element.id))).toBe(true);
    expect(snapshot.elements.map((element) => element.text).join(" ")).not.toContain("secret");
    expect(snapshot.elements.at(-1)?.href).toBe("http://localhost:3000/details");
  });

  it("groups repeated card structures and avoids indexing their descendants twice", () => {
    load(`
      <div class="results">
        <div class="result-card"><h2>First role</h2><p>A detailed role description.</p></div>
        <div class="result-card"><h2>Second role</h2><p>Another detailed description.</p></div>
      </div>
    `);
    const snapshot = createPageEngine(document).scan();

    expect(snapshot.elements).toHaveLength(2);
    expect(snapshot.elements.every((element) => element.kind === "card")).toBe(true);
  });

  it("maps a snapshot ID to the real element and reverses highlighting", () => {
    load(`<p>Privacy controls are available for every account.</p>`);
    const paragraph = document.querySelector("p")!;
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements[0]!.id;

    const applied = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [id] }],
    });
    expect(applied[0]).toMatchObject({ success: true, affectedElementIds: [id] });
    expect(paragraph.classList.contains("contextlayer-engine-highlight")).toBe(true);

    const restored = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "RESTORE_ALL" }],
    });
    expect(restored[0]?.success).toBe(true);
    expect(paragraph.classList.contains("contextlayer-engine-highlight")).toBe(false);
    expect(document.querySelector("[data-contextlayer-engine-styles]")).toBeNull();
  });

  it("applies effects idempotently and clears only engine-owned changes", () => {
    load(`<div class="card" style="color: blue"><p>Candidate details for this listing.</p></div>`);
    const card = document.querySelector(".card")! as HTMLElement;
    card.classList.add("website-class");
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements[0]!.id;

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "DIM", targetElementIds: [id] },
        { type: "STRIKE", targetElementIds: [id, id] },
        { type: "STRIKE", targetElementIds: [id] },
      ],
    });
    expect(card.querySelectorAll("[data-contextlayer-strike-overlay]")).toHaveLength(1);

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "CLEAR_EFFECT", targetElementIds: [id] }],
    });
    expect(card.classList.contains("website-class")).toBe(true);
    expect(card.style.color).toBe("blue");
    expect(card.querySelector("[data-contextlayer-strike-overlay]")).toBeNull();
  });

  it("scrolls, hides safe targets, and rejects unsafe roots", () => {
    load(`<main>Main application content that must remain visible.</main><p>Optional supporting paragraph.</p>`);
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const paragraph = document.querySelector("p")!;
    paragraph.scrollIntoView = vi.fn();
    const paragraphId = snapshot.elements.find((element) => element.tagName === "p")!.id;

    const results = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [
        { type: "SCROLL_TO", targetElementIds: [paragraphId] },
        { type: "HIDE", targetElementIds: [paragraphId] },
      ],
    });
    expect(results.every((result) => result.success)).toBe(true);
    expect(paragraph.scrollIntoView).toHaveBeenCalledOnce();
    expect(paragraph.classList.contains("contextlayer-engine-hidden")).toBe(true);

    const mainId = snapshot.elements.find((element) => element.tagName === "main")!.id;
    const unsafe = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIDE", targetElementIds: [mainId] }],
    });
    expect(unsafe[0]?.failures[0]?.code).toBe("UNSAFE_TARGET");
  });

  it("rejects stale snapshots and invalid element IDs without changing the DOM", () => {
    load(`<p>A stable paragraph containing useful information.</p>`);
    const engine = createPageEngine(document);
    const first = engine.scan();
    const second = engine.scan();

    const stale = engine.executeActions({
      pageId: first.pageId,
      snapshotVersion: first.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [first.elements[0]!.id] }],
    });
    expect(stale[0]?.failures[0]?.code).toBe("STALE_SNAPSHOT");

    const unknown = engine.executeActions({
      pageId: second.pageId,
      snapshotVersion: second.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["node-99999"] }],
    });
    expect(unknown[0]?.failures[0]?.code).toBe("UNKNOWN_ID");
    expect(document.querySelector("p")?.classList.contains("contextlayer-engine-highlight")).toBe(false);
  });

  it("reports a mapped element that was detached after scanning", () => {
    load(`<p>A paragraph that will be removed after the page snapshot.</p>`);
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements[0]!.id;
    document.querySelector("p")!.remove();

    const result = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [id] }],
    });
    expect(result[0]?.failures[0]?.code).toBe("DETACHED_NODE");
  });
});
