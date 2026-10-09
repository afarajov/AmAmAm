# Authoritative shared contract

[`types.ts`](types.ts) is the single source of truth shared by all three components.

Only the lead architect approves changes to it. Other developers must report incompatibilities instead of editing or redefining the types independently.

Workspace code should use the package import:

```ts
import type {
  AgentRequest,
  AgentResponse,
  PageEngine,
  PageSnapshot,
} from "@contextlayer/shared";
```

The package entry point in `packages/shared/src/index.ts` only re-exports this file; it does not define a second contract.

TypeScript types do not validate network or LLM JSON at runtime. The backend owner must derive or maintain runtime schemas and test them against this contract.
