# Prompts for the other two coding agents

Send the relevant block after both developers pull the architecture commit.

## Developer 2 — DOM Engine

```text
IMPORTANT INTEGRATION INSTRUCTION

You own packages/page-engine only.

The lead architect finalized the shared TypeScript contract at:
shared/types.ts

Import it through @contextlayer/shared. Do not redefine, rename, or modify
the shared interfaces without approval.

Implement the PageEngine interface exactly, including:
- scan(): PageSnapshot
- executeActions(request: ExecuteActionsRequest): ActionExecutionResult[]

Your component owns semantic DOM extraction, document-local element mapping,
action validation, reversible visual effects, stale snapshot handling, and
DOM engine tests.

Do not implement AI reasoning, backend requests, Chrome UI, or an alternative
shared contract. If a contract field is insufficient, report the exact issue
before changing code.
```

## Developer 3 — Extension, UI and playground

```text
IMPORTANT INTEGRATION INSTRUCTION

You own apps/extension and apps/playground only.

The lead architect finalized the shared TypeScript contract at:
shared/types.ts

Import it through @contextlayer/shared. Do not redefine, rename, or modify
the shared interfaces without approval.

The DOM Engine will implement the PageEngine interface from that contract.
The backend will accept AgentRequest and return AgentResponse.

Implement Manifest V3 activation, isolated chat UI, runtime/API adapters,
loading/error states, reference navigation, and the public playground.
Both clients must use @contextlayer/page-engine; do not create a second DOM
extraction or action engine. Mocks are allowed only when they match the shared
contracts exactly.

If a contract field is insufficient, report the exact issue before changing it.
```
