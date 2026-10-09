import { describe, expect, it } from "vitest";
import { createPageEngine } from "../src/index.js";
import wikipediaArticleHtml from "./fixtures/wikipedia-like-article.html?raw";

function load(html: string, path = "/quality"): void {
  document.documentElement.innerHTML = `<head><title>Extraction quality</title></head><body>${html}</body>`;
  window.history.replaceState({}, "", path);
}

describe("Page Engine extraction quality", () => {
  it("prioritizes Wikipedia-like article content over navigation and site chrome", () => {
    load(wikipediaArticleHtml, "/wiki/Ada_Lovelace");
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const text = snapshot.elements.map((element) => element.text).join(" ");

    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Bernoulli numbers");
    expect(text).toContain("Notes on the Analytical Engine");
    expect(snapshot.elements.some((element) => element.kind === "table-row")).toBe(true);
    expect(snapshot.elements.some((element) => element.kind === "list-item")).toBe(true);
    expect(text).not.toContain("Random article");
    expect(text).not.toContain("Repeated site promotion");
    expect(text).not.toContain("Privacy policy");
    engine.dispose();
  });

  it("keeps only the most specific copy of deeply nested duplicate text", () => {
    load(`
      <main>
        <article>
          <div class="content-shell">
            <div class="content-shell">
              <span>The same readable sentence must occur only once in the final snapshot.</span>
            </div>
          </div>
          <p><span>A paragraph split across nested spans remains one semantic block.</span></p>
        </article>
      </main>
    `);
    const snapshot = createPageEngine(document, { observeMutations: false }).scan();

    expect(snapshot.elements.filter((element) => element.text.includes("same readable sentence"))).toHaveLength(1);
    expect(snapshot.elements.filter((element) => element.text.includes("split across nested spans"))).toHaveLength(1);
  });

  it("keeps IDs for unchanged nodes and never reuses a removed node ID", () => {
    load(`
      <main id="content">
        <p id="alpha">Alpha paragraph contains stable semantic content.</p>
        <p id="beta">Beta paragraph also remains unchanged between scans.</p>
      </main>
    `);
    const engine = createPageEngine(document, { observeMutations: false });
    const first = engine.scan();
    const alphaId = first.elements.find((element) => element.text.startsWith("Alpha"))!.id;
    const betaId = first.elements.find((element) => element.text.startsWith("Beta"))!.id;

    document.querySelector("#alpha")!.remove();
    const inserted = document.createElement("p");
    inserted.id = "newcomer";
    inserted.textContent = "A newly inserted paragraph must receive a fresh identifier.";
    document.querySelector("#content")!.prepend(inserted);
    const second = engine.scan();

    expect(second.snapshotVersion).toBe(first.snapshotVersion + 1);
    expect(second.elements.find((element) => element.text.startsWith("Beta"))?.id).toBe(betaId);
    const newcomerId = second.elements.find((element) => element.text.startsWith("A newly"))!.id;
    expect(newcomerId).not.toBe(alphaId);
    expect(Number(newcomerId.slice("node-".length))).toBeGreaterThan(
      Number(betaId.slice("node-".length)),
    );
    engine.dispose();
  });

  it("bounds and deterministically truncates a very large page while retaining useful content", () => {
    const navigation = Array.from(
      { length: 1_000 },
      (_, index) => `<div class="toolbar-item"><a href="/navigation/${index}">Navigation item ${index}</a></div>`,
    ).join("");
    const paragraphs = Array.from(
      { length: 1_200 },
      (_, index) => `<p>Article paragraph ${String(index).padStart(4, "0")} contains detailed evidence about the release candidate and deterministic extraction behavior.</p>`,
    ).join("");
    load(`
      <div class="site-tools">${navigation}</div>
      <main><article><h1>Large article benchmark</h1>${paragraphs}</article></main>
    `, "/large-article");
    const engine = createPageEngine(document, {
      observeMutations: false,
      maxDomNodes: 5_000,
      maxCandidates: 600,
      maxElements: 40,
      maxTotalTextLength: 3_000,
      maxElementTextLength: 100,
    });

    const startedAt = performance.now();
    const first = engine.scan();
    const elapsedMs = performance.now() - startedAt;
    const second = engine.scan();
    const totalTextLength = first.elements.reduce((total, element) => total + element.text.length, 0);

    expect(first.elements.length).toBeLessThanOrEqual(40);
    expect(totalTextLength).toBeLessThanOrEqual(3_000);
    expect(first.elements.every((element) => element.text.length <= 100)).toBe(true);
    expect(first.elements.some((element) => element.text === "Large article benchmark")).toBe(true);
    expect(first.elements.some((element) => element.text.startsWith("Navigation item"))).toBe(false);
    expect(second.elements).toEqual(first.elements);
    expect(second.snapshotVersion).toBe(first.snapshotVersion);
    expect(elapsedMs).toBeLessThan(2_000);
    engine.dispose();
  });

  it("does not inspect iframe documents or claim access across browser boundaries", () => {
    load(`
      <main><p>Visible top-level document content.</p></main>
      <iframe src="https://cross-origin.example/private">Private frame fallback secret</iframe>
    `);
    const engine = createPageEngine(document, { observeMutations: false });
    const snapshot = engine.scan();
    const text = snapshot.elements.map((element) => element.text).join(" ");

    expect(text).toContain("Visible top-level document content");
    expect(text).not.toContain("Private frame fallback secret");
    const failure = engine.executeActions({
      pageId: snapshot.pageId,
      snapshotVersion: snapshot.snapshotVersion,
      actions: [{ type: "HIGHLIGHT", targetElementIds: ["frame-node-unknown"] }],
    });
    expect(failure[0]?.failures[0]?.code).toBe("UNKNOWN_ID");
    engine.dispose();
  });
});
