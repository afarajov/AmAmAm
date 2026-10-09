# Extension workspace — Developer 3

The extension shell and isolated chat interface are implemented. It builds a
Manifest V3 extension that injects a Shadow DOM launcher after a user clicks
the toolbar action. The panel supports open/close behavior, message entry,
session history, answer copy/rating/retry controls, loading/error states and
responsive layouts. Only working product controls are exposed: API credentials
remain server-side and the extension does not render placeholder settings.

The extension uses the real `@contextlayer/page-engine` and communicates with
the backend through the background service worker. A separately labelled mock
build remains available for isolated UI development:

```text
message -> mock snapshot -> mock agent response -> chat history
```

The orchestration boundary is `src/integration/agentSession.ts`; both real and
mock gateways implement the same contract.

Assistant responses show source references and the actual result returned for
every DOM action. Selecting a source performs a local `SCROLL_TO`. The reset
control becomes available only after the Page Engine reports an affected DOM
element and executes `RESTORE_ALL` locally without another agent request.

## API mode

The API adapter uses extension runtime messaging so page context is sent by the
background service worker rather than page JavaScript. The normal build uses
API mode:

```bash
npm run build -w @contextlayer/extension
```

API mode targets `http://127.0.0.1:8787/api/agent/query` by default and adds
that exact origin to `host_permissions`. For isolated UI work, use
`npm run build:mock -w @contextlayer/extension`. A deployed API origin can be supplied
with `VITE_CONTEXTLAYER_API_BASE_URL`; its matching manifest permission must be
updated before distribution.

API builds are written to `dist`; mock builds are isolated in `dist-mock` so
tests can never replace the unpacked production extension by accident.

## Build and load

```bash
npm run typecheck -w apps/extension
npm run build -w apps/extension
npm test -w apps/extension
npm run test:e2e -w apps/extension
```

The Playwright suite builds the deterministic mock mode and covers references,
scroll navigation, executor results, failed actions, and local reset behavior.

## Dynamic pages

The extension watches the active document URL so `pushState`, `replaceState`,
back/forward navigation, and hash navigation invalidate the previous page
context. Old references and action state are cleared immediately. The next
request waits briefly for the dynamic DOM to settle and always creates a fresh
snapshot.

If the Page Engine returns `STALE_SNAPSHOT`, the session performs one automatic
rescan and repeats the agent request against the new snapshot. A second stale
result is surfaced as a rescan-required state instead of applying outdated
actions. Empty pages and backend timeouts have separate user-facing states.

Checkpoint 3 Playwright fixtures cover a nested Instagram-like caption, SPA
post navigation, repeated queries, stale recovery, backend timeout, and an
honest no-readable-text result.

## Action lifecycle

The chat keeps the backend plan separate from the browser execution result.
Every `ActionExecutionResult` is presented with its real affected and failed
counts for `SCROLL_TO`, `HIGHLIGHT`, `DIM`, `STRIKE`, `HIDE`, `CLEAR_EFFECT`,
and `RESTORE_ALL`. Raw element IDs and executor messages are never rendered.

Source navigation replaces its previous `HIGHLIGHT` and `SCROLL_TO` status
instead of appending duplicates. Reset remains a local `RESTORE_ALL`, is
enabled only while real effects remain, and never calls the backend. A
synchronous request lock prevents duplicate submissions before React state has
time to render.

Checkpoint 4 Playwright coverage asserts the actual DOM classes and restored
state for all effects, partial failure reporting, stale retry limits, route
changes during a request, malformed responses, backend errors, and duplicate
submit protection.

Load `apps/extension/dist` as an unpacked extension in Chrome. Open a regular
HTTP(S) page and click the ContextLayer toolbar action. Restricted browser
pages are rejected without requesting broad host access.

## Responsibilities

- Manifest V3 configuration and minimal permissions;
- toolbar-triggered injection without forced reload;
- background service worker lifecycle;
- isolated chat UI, preferably Shadow DOM;
- client-side request, loading and error states;
- orchestration of `@contextlayer/page-engine` and `@contextlayer/shared`;
- showing references and actual executor results.

## Structure

```text
src/
├── background/   # activation and backend bridge
├── content/      # integration entry point; no extraction implementation
├── ui/           # chat components and isolated styles
└── adapters/     # Chrome messaging and API client
tests/
```

Do not duplicate schemas, DOM extraction or DOM action logic here.
