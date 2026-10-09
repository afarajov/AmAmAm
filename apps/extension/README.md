# Extension workspace — Developer 3

The extension shell and isolated chat interface are implemented. It builds a
Manifest V3 extension that injects a Shadow DOM launcher after a user clicks
the toolbar action. The panel supports open/close behavior, message entry,
history presentation, loading/error states and responsive layouts.

The backend and page engine are not connected yet. A clearly labelled mock mode
exercises the complete client flow with contract-compatible `PageEngine`,
`AgentRequest` and `AgentResponse` values:

```text
message -> mock snapshot -> mock agent response -> chat history
```

The replacement boundary is `src/integration/agentSession.ts`. Real adapters
can replace `src/mocks` without changing the chat component.

## API mode

The API adapter uses extension runtime messaging so page context is sent by the
background service worker rather than page JavaScript. Build it with:

```bash
npm run build:api -w apps/extension
```

API mode targets `http://127.0.0.1:8787/api/agent/query` by default and adds
that exact origin to `host_permissions`. The normal `build` remains mock-only
and does not request backend host access. A deployed API origin can be supplied
with `VITE_CONTEXTLAYER_API_BASE_URL`; its matching manifest permission must be
updated before distribution.

## Build and load

```bash
npm run typecheck -w apps/extension
npm run build -w apps/extension
```

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

## Planned structure

```text
src/
├── background/   # activation and backend bridge
├── content/      # integration entry point; no extraction implementation
├── ui/           # chat components and isolated styles
└── adapters/     # Chrome messaging and API client
tests/
```

Do not duplicate schemas, DOM extraction or DOM action logic here.
