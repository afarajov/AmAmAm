# Page engine — Developer 2

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

`SemanticPageEngine` implements the `PageEngine` contract exported by
`@contextlayer/shared`. A scan creates document-local `node-00001` IDs and
keeps live `Element` references private.

Supported actions are `SCROLL_TO`, `HIGHLIGHT`, `DIM`, `STRIKE`, `HIDE`,
`CLEAR_EFFECT`, and `RESTORE_ALL`. Effects use engine-owned classes and
overlays and are safe to repeat and remove.

Optional extraction limits can be passed to `createPageEngine(document,
options)`. Defaults are 200 blocks, 30,000 total text characters, and 2,000
characters per block. Client UI can be excluded with `data-contextlayer-ui`.

## Validation

From the repository root:

```powershell
npm.cmd run typecheck --workspace @contextlayer/page-engine
npm.cmd test --workspace @contextlayer/page-engine
```

The extractor intentionally excludes hidden content, form values, scripts,
styles, and extension UI. It uses heuristic card/comment detection; canvas,
closed shadow roots, cross-origin frames, and virtualized off-screen content
remain outside the MVP.

The unit suite uses real HTML fixtures from `tests/fixtures/`, including visible
content, hidden descendants, sensitive form controls, links, and client UI that
must be excluded from the snapshot.
