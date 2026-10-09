# Integration contracts

The executable source of truth is `packages/shared/src/index.ts`. This document explains semantics that TypeScript alone cannot express.

All snapshots currently carry `contractVersion: "1"`. Requests and responses share a UUID `requestId` for correlation across extension, API logs and error reports.

## Snapshot identity

- `pageId` identifies one loaded document.
- `snapshotVersion` increases after every meaningful recapture.
- `node-00001` identifiers are unique only inside one snapshot/document session.
- The browser rejects actions for a different page or stale/detached node.

## Agent endpoint

```text
POST /api/agent/query
Content-Type: application/json

AgentRequest → AgentResponse
```

The backend may reduce context internally, but returned IDs must come from the submitted snapshot.

Recommended errors:

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Request failed schema validation |
| 413 | `CONTEXT_TOO_LARGE` | Configured payload budget exceeded |
| 429 | `RATE_LIMITED` | Client should retry later |
| 502 | `MODEL_ERROR` | Provider failed or output was invalid |
| 504 | `MODEL_TIMEOUT` | Provider exceeded the deadline |

## Action semantics

- `SCROLL_TO`: navigate visually; no content modification.
- `HIGHLIGHT`: emphasize selected blocks.
- `DIM`: reduce prominence without removing content.
- `STRIKE`: visually exclude while preserving content.
- `HIDE`: temporarily collapse only a safe semantic block.
- `RESTORE_ALL`: remove every page-engine-owned effect.
- `CLEAR_EFFECT`: remove page-engine effects from specified targets.
- `OPEN_LINK`: allowed only after explicit user intent and URL validation.

The LLM proposes actions. The page engine decides whether they are executable.

## Serialization boundary

Allowed across API/runtime messages:

- plain JSON values;
- element IDs;
- normalized text and safe attributes;
- execution summaries.

Never serialize:

- DOM nodes;
- functions or generated JavaScript;
- cookies, tokens or browser storage;
- passwords or form input values;
- arbitrary page HTML.

## Compatibility rule

Before the first release, breaking contract changes are allowed but must be coordinated. Once a demo build is frozen, add `contractVersion` before evolving the wire format.
