# Checkpoint 5 — Release candidate

## Goal

Produce one reproducible, secure and demo-ready release candidate from the
working Checkpoint 4 vertical slice. This checkpoint is for hardening,
packaging and real end-to-end validation. It must not introduce a second
architecture, speculative features or contract churn.

## Shared rules

- Start from the Checkpoint 4 commit on `main`.
- Work only in the assigned directories and existing feature branch.
- Import shared contracts from `@contextlayer/shared`; do not duplicate them.
- Do not modify shared contracts unless all three owners approve the exact diff.
- Keep API credentials exclusively in the backend environment.
- Production builds must never silently fall back to mock behavior.
- Do not claim an action succeeded until `ActionExecutionResult` confirms it.
- Do not expose internal element IDs, model output, stack traces or secrets to users.
- Prefer small, tested fixes over new abstractions.

## Agent 1 — AI backend

Branch: `intelligence-backend-system`

Ownership: `apps/api`, backend-facing documentation and backend tests.

Deliverables:

1. Add fail-fast production environment validation for the model, API key,
   port, allowed extension origins and request limits.
2. Keep CORS explicit and configurable. Never use wildcard CORS with extension
   requests and never log credentials or full page snapshots.
3. Finalize the public health/readiness endpoint and stable error contract for
   timeout, rate limit, provider failure, invalid model output and oversized
   requests.
4. Add bounded retry behavior only for retryable provider failures. Preserve
   `requestId` across logs and responses.
5. Enforce page/context size limits before the LLM call and return an honest,
   user-safe error when the request cannot be processed.
6. Add structured, privacy-safe request logs containing status, duration,
   request ID and error code only.
7. Add tests for missing configuration, CORS allow/deny, timeout, 429/retry,
   oversized payload, malformed model response, grounded answer and action-only
   requests.
8. Update `apps/api/README.md` with exact local and production startup steps.

Do not change DOM extraction, extension UI, shared contracts or add a database.

## Agent 2 — Page Engine

Branch: `feature/page-engine`

Ownership: `packages/page-engine` and its tests/fixtures.

Deliverables:

1. Stabilize extraction on large and dynamic pages without site-specific code.
2. Prevent duplicate nested text and irrelevant navigation/chrome from crowding
   out the main article/post content.
3. Keep deterministic element IDs for unchanged nodes during a document
   lifetime and invalidate stale mappings after navigation or material change.
4. Define and enforce bounded snapshot limits with deterministic truncation and
   useful-content priority.
5. Ensure every visual effect is reversible after detached nodes, partial
   failures, repeated actions and `RESTORE_ALL`.
6. Treat inaccessible/cross-origin frames honestly; do not bypass browser
   security boundaries.
7. Add fixture tests for Wikipedia-like articles, Instagram-like posts,
   YouTube-like listings, a large page, repeated nested text, SPA mutation,
   detached targets and a full action/reset cycle.
8. Document extraction limits and supported behavior in
   `packages/page-engine/README.md`.

Do not implement AI, network calls, extension UI or site-specific selectors.

## Agent 3 — Extension, UI and playground

Branch: `feature/extension-ui`

Ownership: `apps/extension`, `apps/playground` and their tests.

Deliverables:

1. Turn the current build into a release candidate with one explicit production
   API origin and matching minimal Manifest V3 permissions.
2. Preserve and finish the working Settings and History features. Verify theme,
   accent, sizes, launcher position, personalization, export/delete/clear and
   persistence after browser restart.
3. Add a small first-run connection check that distinguishes backend offline,
   invalid configuration, timeout and provider rate limit without exposing
   technical internals.
4. Ensure history stores only the intended chat text and page metadata locally;
   never store API keys, raw snapshots, internal IDs or executor diagnostics.
5. Ensure every visible control works or remove it. Keep keyboard navigation,
   focus states, readable contrast and responsive layout.
6. Make mock mode impossible to confuse with the production build and keep its
   output directory separate.
7. Add a reproducible release build/package command and document how to load and
   verify the unpacked extension.
8. Add Playwright coverage for settings/history persistence, restricted pages,
   backend unavailable, timeout/rate limit, malformed response, SPA navigation,
   grounded answer, source navigation, action execution and reset.
9. Keep the playground as a truthful integration surface using the same Page
   Engine and API adapter; no canned production answers.

Do not implement an alternative DOM engine, backend reasoning or shared types.

## Integration gate

Create `integration/checkpoint-5` from the Checkpoint 5 base on `main`, then
merge in this order:

1. `feature/page-engine`
2. `intelligence-backend-system`
3. `feature/extension-ui`

Run:

```bash
npm ci
npm run check
npm run test:e2e --workspace @contextlayer/extension
npm run build --workspace @contextlayer/extension
npm run release --workspace @contextlayer/extension
```

Then run a real Chrome test with the actual backend and a valid API key:

1. grounded Russian question on an English page;
2. honest answer when information is absent;
3. source click scrolls to the correct element;
4. `HIGHLIGHT`, `DIM`, `STRIKE`, `HIDE`, `CLEAR_EFFECT`, then `RESTORE_ALL`;
5. refresh and verify chat/settings persistence;
6. SPA navigation followed by a new query;
7. backend stopped, timeout and rate-limit user messages;
8. Wikipedia-like, Instagram-like and YouTube-like pages.

Checkpoint 5 is complete only when all automated checks pass, the real test has
no blocker, the production extension shows `API mode`, and `git status` is
clean. Only then merge `integration/checkpoint-5` into `main`.
