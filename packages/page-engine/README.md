# Page engine workspace — Developer 2

No DOM implementation exists yet.

## Responsibilities

- capture a bounded `PageSnapshot`;
- maintain document-local `WeakMap<Element, string>` and `Map<string, Element>`;
- identify semantic blocks without redundant parent/child text;
- exclude UI, hidden content, form values and sensitive data;
- validate current page/snapshot before actions;
- execute allow-listed actions deterministically;
- track only engine-owned effects and restore them safely;
- return per-target execution results.

## Planned structure

```text
src/
├── extraction/   # candidate discovery and normalization
├── mapping/      # page identity and live element maps
├── actions/      # safe reversible executor
├── observer/     # optional debounced dynamic refresh
└── index.ts      # small public facade
tests/
└── fixtures/
```

The package may depend on `@contextlayer/shared`. It must not call the API, parse natural language or render UI.
