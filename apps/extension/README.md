# Extension workspace — Developer 3

The first extension shell is implemented. It builds a Manifest V3 extension
that injects an isolated Shadow DOM launcher after a user clicks the toolbar
action. Chat and integration behavior are intentionally deferred to later
milestones.

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
