# System architecture

## Goal

ContextLayer connects natural-language understanding to real elements on the active webpage. The architecture separates probabilistic interpretation from deterministic browser execution.

```text
Injected chat UI
      │
      │ user query + PageSnapshot
      ▼
Extension background ───────► AI API
                                  │
                                  │ validated AgentResponse
                                  ▼
Content integration ◄──────── structured plan
      │
      ▼
Page engine validates current page and element IDs
      │
      ▼
Deterministic DOM actions + execution results
```

## Trust boundaries

The webpage and the LLM are both untrusted.

- Page text is evidence, never executable instruction.
- Live `Element` references never leave the browser document.
- The backend receives only serializable, sanitized semantic blocks.
- The model may select only actions defined in `packages/shared`.
- Model output must pass runtime schema validation.
- The browser must revalidate page identity, snapshot version, target IDs, node connectivity, and action safety.
- UI success messages must reflect executor results, not model claims.

## Modules

### `packages/shared`

Canonical transport types and runtime schemas. It owns the vocabulary, not application behavior.

### `apps/api`

Owns request validation, candidate retrieval, LLM instructions/provider adapter, structured planning, output validation, timeouts and API errors.

### `packages/page-engine`

Owns semantic discovery, page identity, snapshot generation, local ID maps, target resolution, reversible effects and execution reports.

### `apps/extension`

Owns Manifest V3 lifecycle, user activation, isolated chat UI, runtime messaging and orchestration between the page engine and API.

### `apps/playground`

Owns the public no-install demo. It must use `packages/page-engine` and the real API contract rather than fixture-specific action logic.

## First vertical slice

Only one path should be integrated initially:

1. Extension/playground requests a snapshot from the page engine.
2. Client sends `AgentRequest` to `POST /api/agent/query`.
3. API returns a schema-valid `AgentResponse` containing `HIGHLIGHT` and valid IDs.
4. Page engine executes the action against its local map.
5. UI reports actual success/failure.

After that works, add answer citations, scroll, dim, strike, hide and restore in that order.

## Explicitly excluded from the foundation

- Provider-specific implementation code;
- DOM heuristics;
- extension permissions and host domains;
- UI framework and styling;
- deployment configuration;
- fabricated tests, metrics or demo responses.

Those decisions belong to the respective owners and must be recorded when made.
