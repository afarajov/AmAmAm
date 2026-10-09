# Team ownership

## Developer 1 — architecture, AI and backend

Owns:

- `packages/shared/**`
- `apps/api/**`
- API and model contracts
- intent interpretation and multilingual behavior
- retrieval and context budgeting
- LLM provider integration and system instructions
- structured action planning and output validation
- backend tests, observability and deployment contract

Does not implement DOM traversal, DOM effects, extension UI or Chrome lifecycle.

## Developer 2 — page engine

Owns:

- `packages/page-engine/**`
- semantic element discovery
- `pageId`, `snapshotVersion` and document-local ID maps
- extraction limits, visibility and deduplication
- deterministic action execution
- reversible modifications and stale-node handling
- DOM fixtures and engine tests

Does not call the backend, interpret natural language, render chat UI or maintain provider prompts.

## Developer 3 — client and integration

Owns:

- `apps/extension/**`
- `apps/playground/**`
- Manifest V3 lifecycle and injection
- Shadow DOM chat UI
- background/content messaging
- API client and loading/error states
- reference navigation
- public demo UX and client deployment
- end-to-end integration tests

Does not duplicate shared schemas, semantic extraction, DOM actions or AI planning.

## Change protocol

1. Owners may change implementation details freely inside their boundary.
2. Changes to `packages/shared` require a short proposal to both downstream owners.
3. A contract change is merged only after API, page-engine and client compile against it.
4. Cross-owner edits should be exceptional and reviewed by the owning developer.
5. Each handoff reports files changed, public interfaces, test command, result, limitations and integration needs.

## Branch suggestion

- `feature/ai-backend`
- `feature/page-engine`
- `feature/extension-ui`

Integrate frequently through small pull requests; do not wait until all three components are independently “finished.”
