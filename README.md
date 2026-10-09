# ContextLayer — architecture foundation

This repository is the contract-first starting point for a three-developer hackathon build. It intentionally contains **no implemented backend, DOM engine, Chrome extension, chat UI, or playground**.

The purpose of this commit is to let the team work in parallel without inventing incompatible interfaces.

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

Only the workspace skeleton, canonical contract package, architectural documentation, and package boundaries exist. Package manifests intentionally omit implementation dependencies and runnable build/dev/test commands; each owner adds those within their area.

The only current validation command is:

```bash
npm install
npm run typecheck:contracts
```

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
