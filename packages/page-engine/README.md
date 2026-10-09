# Page engine

Reusable semantic DOM extraction and reversible action execution for a normal
browser `Document`. The package has no Chrome API, backend, LLM, or UI coupling.

## Public API

```ts
import { createPageEngine } from "@contextlayer/page-engine";

const engine = createPageEngine(document);
const snapshot = engine.scan();

const results = engine.executeActions({
  pageId: snapshot.pageId,
  snapshotVersion: snapshot.snapshotVersion,
  actions: [
    {
      type: "HIGHLIGHT",
      targetElementIds: [snapshot.elements[0].id],
    },
  ],
});
```

For a dynamic SPA route, consumers can wait for meaningful rendered content:

```ts
const snapshot = await engine.scanWhenReady();

const unsubscribe = engine.onPageChange((reason) => {
  // Discard responses/actions for the previous snapshot and scan again.
  console.info("Page snapshot invalidated:", reason);
});
```

`scanWhenReady()` waits for DOM readiness, meaningful text, and a short quiet
period. `MutationObserver` invalidates an active snapshot after relevant DOM
changes while ignoring ContextLayer effects and client UI. Call `dispose()`
when the engine is no longer used.

## Semantic extraction

The engine recognizes headings, paragraphs, articles, sections, posts,
comments, list items, table rows, meaningful links, and repeated card-like
structures. Repeated custom elements are handled generically; extraction does
not contain website-specific adapters or selectors.

The scanner:

- considers rendered text only;
- excludes scripts, styles, form values, hidden subtrees and ContextLayer UI;
- rejects navigation/menu subtrees and site chrome outside primary content;
- prefers readable content inside `main`, `article`, and corresponding roles;
- keeps the most specific useful copy of nested duplicate text;
- normalizes whitespace and uses deterministic, prefix-based truncation;
- returns selected blocks in their original DOM order.

### Default snapshot limits

| Limit | Default | Meaning |
|---|---:|---|
| `maxDomNodes` | 20,000 | Maximum elements inspected in one synchronous scan |
| `maxCandidates` | 2,000 | Maximum candidates fully extracted and scored |
| `maxElements` | 200 | Maximum semantic elements in a snapshot |
| `maxTotalTextLength` | 30,000 | Maximum combined element text characters |
| `maxElementTextLength` | 2,000 | Maximum text characters for one element |
| `readinessTimeoutMs` | 3,000 ms | Maximum default wait for dynamic content |
| `readinessSettleMs` | 100 ms | Quiet period before `scanWhenReady()` captures |

All limits can be overridden through `PageEngineOptions`. Invalid or non-positive
size limits fall back to these defaults. Candidate and snapshot selection use
stable scoring and DOM-order tie breaking, so the same unchanged document and
options produce the same bounded output.

## Identity and dynamic pages

- `pageId` identifies the `Document` owned by one engine instance.
- Element IDs are assigned monotonically and retained in a `WeakMap` for the
  lifetime of that document. An unchanged node keeps its ID across scans.
- IDs belonging to removed nodes are not reused for unrelated nodes.
- Only elements in the current snapshot are resolvable through the live ID map.
- The first snapshot has `snapshotVersion: 1`.
- A repeated scan with unchanged semantic content and URL keeps the version.
- A material DOM mutation or SPA URL change increments the version once and
  invalidates actions created from the previous snapshot.
- `executeActions()` also consumes queued observer records, closing the window
  between a synchronous DOM mutation and delivery of its observer callback.

Consumers should discard references/actions after `onPageChange`, perform a
fresh scan, and send the new version to the backend.

`SemanticPageEngine` implements the shared `PageEngine` contract plus the local
`DynamicPageEngine` lifecycle API (`scanWhenReady`, `onPageChange`, `dispose`).
A scan creates document-local `node-00001` IDs and keeps live `Element`
references private.

Supported actions are `SCROLL_TO`, `HIGHLIGHT`, `DIM`, `STRIKE`, `HIDE`,
`CLEAR_EFFECT`, and `RESTORE_ALL`. Effects use engine-owned classes and
overlays, support multiple targets and partial failures, and are safe to repeat
and remove. Scrolling temporarily applies a fixed-header-aware
`scroll-margin-top` and restores the page's exact inline style afterwards.

## Action lifecycle

1. Capture a current snapshot.
2. Execute actions with its exact `pageId` and `snapshotVersion`.
3. The engine validates page/version before applying any action.
4. Each target is resolved independently; duplicate IDs are processed once.
5. Partial success reports successful IDs and per-target failures.
6. `CLEAR_EFFECT` removes only ContextLayer effects from the specified targets.
7. `RESTORE_ALL` removes every ContextLayer class, overlay, and style node,
   including effects tracked on a node that was subsequently detached.

Unknown IDs return `UNKNOWN_ID`, detached mapped nodes return `DETACHED_NODE`,
and old page/version requests return `STALE_SNAPSHOT`. Engine-owned effects do
not alter semantic snapshot content or overwrite original website classes and
inline styles.

## Browser boundaries

Extraction covers only the supplied top-level `Document`. It does not inspect
cross-origin iframe documents, closed shadow roots, canvas pixels, images,
video, or virtualized content that is absent from the DOM. The engine never
attempts to bypass same-origin policy. Because inaccessible frame descendants
never receive element IDs, attempts to target fabricated frame IDs fail with
`UNKNOWN_ID` through the existing action result contract.

## Validation

From the repository root, run exactly:

```bash
npm run typecheck --workspace @contextlayer/page-engine
npm test --workspace @contextlayer/page-engine
npm run check
```

On Windows hosts that block PowerShell shim scripts, use `npm.cmd` with the same
arguments.

The unit suite uses real HTML fixtures from `tests/fixtures/`, including an
ordinary article, Wikipedia-like long article, multilingual social post,
repeated feed cards, generic custom-element video listing, large generated
page, dynamic SPA shell, sensitive-content fixture, and complex action page.
Tests cover bounded performance, stable identity, duplicate suppression,
computed effects, idempotency, partial failures, detached nodes, stale
snapshots, fixed-header scrolling, navigation, and full restoration.
