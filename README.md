# ContextLayer

ContextLayer is a Chrome extension that understands the current page, answers grounded questions about it, and executes reversible visual actions such as highlighting and scrolling to relevant content.

## Ownership

| Area | Owner | Directories |
|---|---|---|
| Architecture, contracts, AI reasoning, LLM and backend | Developer 1 | `packages/shared`, `apps/api` |
| Semantic DOM extraction and reversible actions | Developer 2 | `packages/page-engine` |
| Chrome extension, chat UI, playground and integration | Developer 3 | `apps/extension`, `apps/playground` |

See [team ownership](docs/team-ownership.md) before changing code outside an owned directory.

## Intended dependency direction

```text
packages/shared
      ↑
      ├──────── apps/api
      └──────── packages/page-engine
                      ↑
                      ├──────── apps/extension
                      └──────── apps/playground
```

Rules:

- `packages/shared` contains serializable contracts only and must not import application code.
- `apps/api` must not import DOM or Chrome APIs.
- `packages/page-engine` must not call an LLM or render product UI.
- `apps/extension` and `apps/playground` integrate the other packages; they must not create alternative AI or DOM engines.
- Contract changes require agreement from all three owners.

## Current state

The repository contains the working API, semantic page engine, Manifest V3 extension, integration tests, and playground. The extension includes persistent local chat history and user settings for theme, accent color, text and launcher sizes, launcher position, response style, answer length, emoji usage, keyboard behavior, and custom instructions.

Chat history and settings are stored in `chrome.storage.local`. API keys remain server-side and are never stored in the extension.

Install dependencies and validate the workspace with:

```bash
npm install
npm run check
```

Build the unpacked extension with:

```bash
npm run build --workspace @contextlayer/extension
```

Then load `apps/extension/dist` from `chrome://extensions` with Developer mode enabled. The local API endpoint expected by the development manifest is `http://127.0.0.1:8787`.

## Start here

1. Read [architecture](docs/architecture.md).
2. Read [integration contracts](docs/integration-contracts.md).
3. Confirm ownership in [team ownership](docs/team-ownership.md).
4. Each developer works only in their owned directories.
5. Integrate the first vertical slice as soon as the three adapters exist.

The first shared milestone is:

```text
user query
→ PageSnapshot
→ POST /api/agent/query
→ validated AgentResponse
→ DOM execution result
→ UI confirmation
```
