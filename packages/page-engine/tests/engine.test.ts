import { describe, expect, it, vi } from "vitest";
import { createPageEngine } from "../src/index.js";
import dynamicSpaShellHtml from "./fixtures/dynamic-spa-shell.html?raw";
import instagramPostHtml from "./fixtures/instagram-post.html?raw";
import linkedinFeedHtml from "./fixtures/linkedin-feed.html?raw";
import ordinaryArticleHtml from "./fixtures/ordinary-article.html?raw";
import semanticPageHtml from "./fixtures/semantic-page.html?raw";

function load(html: string): void {
  document.documentElement.innerHTML = `<head><title>Fixture page</title></head><body>${html}</body>`;
  window.history.replaceState({}, "", "/fixture");
}

async function flushMutations(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    load(ordinaryArticleHtml);
    const paragraph = document.querySelector("#shade-paragraph")! as HTMLElement;
    const originalStyle = paragraph.getAttribute("style");
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const target = snapshot.elements.find((element) =>
      element.text.startsWith("Tree canopies provide shade"),
    )!;

    const applied = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [target.id] }],
    });
    expect(applied[0]).toMatchObject({ success: true, affectedElementIds: [target.id] });
    expect(paragraph.classList.contains("contextlayer-engine-highlight")).toBe(true);
    expect(getComputedStyle(paragraph).backgroundColor).toBe("rgba(255, 224, 64, 0.42)");
    expect(paragraph.getAttribute("style")).toBe(originalStyle);

    const restored = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "RESTORE_ALL" }],
    });
    expect(restored[0]?.success).toBe(true);
    expect(paragraph.classList.contains("contextlayer-engine-highlight")).toBe(false);
    expect(paragraph.getAttribute("style")).toBe(originalStyle);
    expect(getComputedStyle(paragraph).backgroundColor).toBe("rgb(12, 34, 56)");
    expect(document.querySelector("[data-contextlayer-engine-styles]")).toBeNull();
  });

  it("keeps a repeated highlight idempotent and preserves website styles", () => {
    load(ordinaryArticleHtml);
    const paragraph = document.querySelector("#shade-paragraph")! as HTMLElement;
    const originalStyle = paragraph.getAttribute("style");
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements.find((element) =>
      element.text.startsWith("Tree canopies provide shade"),
    )!.id;
    const request = {
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT" as const, targetElementIds: [id, id] }],
    };

    const first = engine.executeActions(request);
    const second = engine.executeActions(request);

    expect(first[0]).toMatchObject({ success: true, affectedElementIds: [id] });
    expect(second[0]).toMatchObject({ success: true, affectedElementIds: [id] });
    expect(paragraph.classList.toString().match(/contextlayer-engine-highlight/g)).toHaveLength(1);
    expect(document.querySelectorAll("style[data-contextlayer-engine-styles]")).toHaveLength(1);
    expect(paragraph.getAttribute("style")).toBe(originalStyle);
  });

  it("extracts the ordinary article fixture as headings, paragraphs, list items, and a link", () => {
    load(ordinaryArticleHtml);
    const snapshot = createPageEngine(document).scan();
    const kinds = new Set(snapshot.elements.map((element) => element.kind));

    expect(kinds).toEqual(new Set(["heading", "paragraph", "list-item", "link"]));
    expect(snapshot.elements.some((element) => element.text.includes("resilient canopy"))).toBe(true);
    expect(snapshot.elements.find((element) => element.kind === "link")?.href).toBe(
      "http://localhost:3000/urban-forestry",
    );
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

  it("scrolls the mapped article element with stable navigation options", () => {
    load(ordinaryArticleHtml);
    const paragraph = document.querySelector("#shade-paragraph")!;
    paragraph.scrollIntoView = vi.fn();
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements.find((element) =>
      element.text.startsWith("Tree canopies provide shade"),
    )!.id;

    const result = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "SCROLL_TO", targetElementIds: [id] }],
    });

    expect(result[0]).toEqual({
      type: "SCROLL_TO",
      success: true,
      affectedElementIds: [id],
      failures: [],
    });
    expect(paragraph.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  });

  it("rejects stale snapshots and invalid element IDs without changing the DOM", () => {
    load(`<p>A stable paragraph containing useful information.</p>`);
    const engine = createPageEngine(document);
    const first = engine.scan();
    document.body.append(document.createElement("p"));
    document.body.lastElementChild!.textContent = "New semantic content invalidates the previous page snapshot.";
    const second = engine.scan();

    const stale = engine.executeActions({
      pageId: first.pageId,
      snapshotVersion: first.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [first.elements[0]!.id] }],
    });
    expect(stale[0]?.failures[0]?.code).toBe("STALE_SNAPSHOT");
    expect(stale[0]?.affectedElementIds).toEqual([]);
    expect(document.querySelector("p")?.classList.contains("contextlayer-engine-highlight")).toBe(false);

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
    expect(result[0]?.success).toBe(false);
    expect(result[0]?.affectedElementIds).toEqual([]);
  });

  it("extracts one multilingual caption from an Instagram-like nested article", () => {
    load(instagramPostHtml);
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const captions = snapshot.elements.filter((element) => element.text.includes("Golden hour"));

    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({ kind: "paragraph", tagName: "div" });
    expect(captions[0]?.text).toContain("Закат над старым городом");
    expect(captions[0]?.text).toContain("Köhnə şəhərdə qızılı saat");
    expect(snapshot.elements.map((element) => element.text).join(" ")).not.toContain("Like");
    engine.dispose();
  });

  it("extracts repeated LinkedIn-like feed posts without child duplication", () => {
    load(linkedinFeedHtml);
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const cards = snapshot.elements.filter((element) => element.kind === "card");

    expect(cards).toHaveLength(2);
    expect(cards[0]?.text).toContain("deployment time");
    expect(cards[1]?.text).toContain("accessibility review");
    expect(snapshot.elements.filter((element) => element.text.includes("deployment time"))).toHaveLength(1);
    engine.dispose();
  });

  it("waits for dynamically inserted content before producing a snapshot", async () => {
    load(dynamicSpaShellHtml);
    const engine = createPageEngine(document, {
      readinessTimeoutMs: 1_000,
      readinessSettleMs: 5,
    });
    const pendingSnapshot = engine.scanWhenReady();

    setTimeout(() => {
      document.querySelector("#spa-root")!.innerHTML = `
        <article>
          <div data-testid="post-caption" dir="auto">
            <span>Content that arrived after the SPA data request completed.</span>
          </div>
        </article>
      `;
    }, 10);

    const snapshot = await pendingSnapshot;
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.elements.some((element) => element.text.includes("arrived after"))).toBe(true);
    engine.dispose();
  });

  it("invalidates the active snapshot when dynamic text is added", async () => {
    load(`<main><p>Initial content rendered by the application.</p></main>`);
    const engine = createPageEngine(document);
    const first = engine.scan();
    const originalId = first.elements.find((element) => element.kind === "paragraph")!.id;
    const reasons: string[] = [];
    engine.onPageChange((reason) => reasons.push(reason));

    const paragraph = document.createElement("p");
    paragraph.textContent = "A newly loaded paragraph from an infinite scrolling feed.";
    document.querySelector("main")!.append(paragraph);
    await flushMutations();

    const stale = engine.executeActions({
      pageId: first.pageId,
      snapshotVersion: first.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [originalId] }],
    });
    expect(stale[0]?.failures[0]?.code).toBe("STALE_SNAPSHOT");
    expect(reasons).toEqual(["DOM_MUTATION"]);

    const refreshed = engine.scan();
    expect(refreshed.snapshotVersion).toBe(first.snapshotVersion + 1);
    expect(refreshed.elements.some((element) => element.text.includes("infinite scrolling"))).toBe(true);
    engine.dispose();
  });

  it("handles SPA post navigation without replacing the Document", async () => {
    load(instagramPostHtml);
    const engine = createPageEngine(document);
    const first = engine.scan();
    const oldCaption = first.elements.find((element) => element.text.includes("Golden hour"))!;
    const reasons: string[] = [];
    engine.onPageChange((reason) => reasons.push(reason));

    window.history.pushState({}, "", "/p/second-post");
    document.querySelector("article")!.outerHTML = `
      <article data-testid="post" aria-label="Post by mountain.walker">
        <div data-testid="post-caption" dir="auto">
          <span lang="en">Morning fog moving through the mountain forest.</span>
          <span lang="ru">Утренний туман движется через горный лес.</span>
        </div>
      </article>
    `;
    await flushMutations();

    const stale = engine.executeActions({
      pageId: first.pageId,
      snapshotVersion: first.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [oldCaption.id] }],
    });
    expect(stale[0]?.failures[0]?.code).toBe("STALE_SNAPSHOT");

    const second = engine.scan();
    expect(second.pageId).toBe(first.pageId);
    expect(second.snapshotVersion).toBe(first.snapshotVersion + 1);
    expect(second.url).toBe("http://localhost:3000/p/second-post");
    expect(second.elements.some((element) => element.text.includes("Morning fog"))).toBe(true);
    expect(second.elements.some((element) => element.text.includes("Golden hour"))).toBe(false);
    expect(reasons).toEqual(["SPA_NAVIGATION"]);
    engine.dispose();
  });

  it("keeps snapshotVersion stable when a repeated scan sees no page change", () => {
    load(instagramPostHtml);
    const engine = createPageEngine(document);
    const first = engine.scan();
    const second = engine.scan();

    expect(second.snapshotVersion).toBe(first.snapshotVersion);
    expect(second.elements.map((element) => element.text)).toEqual(
      first.elements.map((element) => element.text),
    );
    engine.dispose();
  });

  it("ignores engine-owned highlight mutations when tracking dynamic page changes", async () => {
    load(`<p>Content that remains stable while ContextLayer highlights it.</p>`);
    const engine = createPageEngine(document);
    const snapshot = engine.scan();
    const id = snapshot.elements[0]!.id;
    const reasons: string[] = [];
    engine.onPageChange((reason) => reasons.push(reason));

    engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: [id] }],
    });
    await flushMutations();

    const restored = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "RESTORE_ALL" }],
    });
    expect(restored[0]?.success).toBe(true);
    expect(reasons).toEqual([]);
    engine.dispose();
  });
});
