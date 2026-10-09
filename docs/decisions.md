# Architectural decisions

## ADR-001 — TypeScript monorepo

**Decision:** npm workspaces with TypeScript across shared contracts, API, browser engine and clients.

**Reason:** one language and direct workspace dependencies reduce integration overhead under the hackathon deadline.

## ADR-002 — Contract-first boundaries

**Decision:** transport types and runtime schemas live only in `@contextlayer/shared`.

**Reason:** three parallel implementations must agree on JSON shape, action vocabulary and ID semantics before writing adapters.

## ADR-003 — LLM proposes; browser decides

**Decision:** the model returns structured actions and never executable JavaScript. The page engine validates and executes them.

**Reason:** model output is probabilistic and untrusted; DOM operations must be deterministic, bounded and reversible.

## ADR-004 — Document-local mappings

**Decision:** live DOM references remain in the page engine. Only snapshot-local IDs cross process boundaries.

**Reason:** DOM nodes are not serializable, and backend ownership of selectors would be stale and unsafe.

## ADR-005 — Shared engine for extension and playground

**Decision:** both clients depend on `@contextlayer/page-engine`.

**Reason:** the public demo must demonstrate the real mechanism rather than a second fixture-specific implementation.

## ADR-006 — No infrastructure beyond the vertical slice

**Decision:** no database, vector store, Redis, queue or multi-agent runtime in the MVP.

**Reason:** bounded lexical retrieval plus one structured model call is enough to prove the product under the available time.
