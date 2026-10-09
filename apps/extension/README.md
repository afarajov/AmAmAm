# Extension workspace — Developer 3

The extension shell and isolated chat interface are implemented. It builds a
Manifest V3 extension that injects a Shadow DOM launcher after a user clicks
the toolbar action. The panel supports open/close behavior, message entry,
history presentation, loading/error states and responsive layouts.

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
