# Extension workspace — Developer 3

The extension shell and isolated chat interface are implemented. It builds a
Manifest V3 extension that injects a Shadow DOM launcher after a user clicks
the toolbar action. The panel supports open/close behavior, message entry,
history presentation, loading/error states and responsive layouts.

The backend and page engine are not connected yet. Submitting a message shows
an explicit unavailable state instead of fabricating an assistant response.

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
