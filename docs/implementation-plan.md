# Parallel implementation plan

## Phase 1 — independent adapters

Developer 1:

- validate `AgentRequest`;
- implement bounded retrieval;
- call the selected LLM with structured output;
- validate IDs/actions and expose `POST /api/agent/query`.

Developer 2:

- implement snapshot capture and local mappings;
- implement `HIGHLIGHT` and `RESTORE_ALL` first;
- return per-target execution results.

Developer 3:

- implement toolbar activation and injected shell;
- render minimal chat states;
- implement runtime/API adapters against shared types.

## Phase 2 — first integration

Integrate one real prompt that highlights one real DOM block. Do not add more operations until this works end to end.

## Phase 3 — P0 completion

- grounded answers and clickable references;
- scroll, dim and strike;
- safe hide and restore;
- article, discussion and listing fixtures;
- multilingual model checks;
- malformed output and prompt-injection tests;
- public deployment and fresh-browser smoke test.

## Merge gates

- imports follow the documented dependency direction;
- runtime inputs are schema-validated at trust boundaries;
- no duplicate contract or DOM implementation exists;
- tests report observed behavior, not planned behavior;
- credentials and sensitive page data never enter source control.
