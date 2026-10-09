# Extension workspace — Developer 3

No extension implementation exists yet.

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
