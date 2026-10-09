# API workspace — Developer 1

The HTTP boundary and OpenAI-backed structured planning pipeline are implemented.

## Local start

Copy `.env.example` to `.env`, place your API key in `OPENAI_API_KEY`, then run
`npm run dev -w @contextlayer/api` from the repository root. Keep the key only
in `apps/api/.env`; the extension never receives it.

Set `CORS_ALLOWED_ORIGINS` to the extension origin shown by Chrome, for example
`chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef`. Separate multiple local
extension origins with commas.

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run dev --workspace @contextlayer/api
```

The development server defaults to `http://127.0.0.1:8787`. Liveness is
available at `GET /health`; `GET /ready` returns `200` only when the model
provider is configured and otherwise returns `503`. Neither endpoint makes a
paid provider request.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `8787` | Server port |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |
| `JSON_BODY_LIMIT` | `512kb` | Express request-body limit |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown deadline |
| `OPENAI_API_KEY` | none | Server-side provider credential |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Structured planning model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Retrieval model |
| `OPENAI_TIMEOUT_MS` | `20000` | Timeout for each provider request |
| `OPENAI_MAX_RETRIES` | `1` | SDK retry count, restricted to `0..2` |
| `CORS_ALLOWED_ORIGINS` | none | Comma-separated explicit extension/HTTP origins |
| `MAX_SNAPSHOT_ELEMENTS` | `300` | Maximum accepted semantic elements |
| `MAX_SNAPSHOT_TEXT_CHARACTERS` | `120000` | Maximum total element-text characters |

`NODE_ENV=production` fails during startup unless `OPENAI_API_KEY` and at least
one explicit `CORS_ALLOWED_ORIGINS` value are present. Wildcard origins and
origins containing paths are rejected. An unlisted browser origin is rejected
before the agent service can make a paid call.

Keep the real key only in `apps/api/.env` or the production secret manager. Do
not place it in `.env.example`, extension environment variables, manifests,
client bundles, logs, screenshots, commits, or issue reports.

## Production start

Set `NODE_ENV=production`, a real provider key, the deployed model names and
the exact extension/API consumer origins, then run:

```bash
npm run typecheck --workspace @contextlayer/api
npm start --workspace @contextlayer/api
```

This repository currently runs TypeScript through `tsx`; the deployment
platform must supervise the process and terminate TLS at its trusted ingress.

Candidate retrieval uses `OPENAI_EMBEDDING_MODEL` (default:
`text-embedding-3-small`) so queries and page content can be matched across
languages before the grounded planning step. Long elements are embedded as
overlapping bounded segments, then ranked by their strongest segment. Embedding
inputs are batched and bounded; the API key remains server-side.

## Grounding guarantees

- factual answers require at least one reference to a supplied candidate element;
- every reference excerpt must be a real substring of that element's text;
- every targeted action ID must also have a supporting reference;
- duplicate and broad parent references collapse to the narrowest grounded element;
- responses contain at most five distinct evidence references and prioritize action targets;
- missing evidence produces a deterministic, language-aware `NOT_FOUND` response;
- page text is passed as untrusted data and cannot change system instructions;
- action responses describe a proposed browser operation, never a completed one.

## Action intent policy

Before a model plan can reach the extension, the API classifies the request as
factual, an explicit page action, or an action with an unresolved target.
Factual requests cannot execute model-proposed actions. Explicit commands are
restricted to the requested action types, compound commands must contain every
requested operation, and `RESTORE_ALL` is accepted only for an explicit full
reset request. Commands such as `hide this` return a localized clarification
without calling the model because the stateless API has no safe referent for
`this`.

Supported action intents are `SCROLL_TO`, `HIGHLIGHT`, `DIM`, `STRIKE`, `HIDE`,
`CLEAR_EFFECT`, and `RESTORE_ALL`, including Russian and English commands.
Targeted actions remain evidence-bound and are deduplicated before transport.

## Responsibilities

- `POST /api/agent/query` and `GET /health`;
- request validation using `@contextlayer/shared`;
- bounded first-stage retrieval;
- multilingual semantic candidate ranking;
- LLM provider adapter and server-side credentials;
- prompt-injection-resistant system instructions;
- structured action planning;
- response schema and element-ID validation;
- timeouts, limits, errors, logging and tests.

The OpenAI SDK performs the configured transport retry. ContextLayer adds only
one application-level retry when a syntactically valid plan fails grounding;
transport retries are bounded by `OPENAI_MAX_RETRIES` and the SDK honors
provider retry headers. After the transport policy is exhausted, rate limits
and timeouts are returned as `RATE_LIMITED` and `MODEL_TIMEOUT`. Validation,
grounding failures, and invalid requests are never transport-retried.

## Public errors and logging

All query failures use the shared `ApiError` envelope and include the request
ID when available. Stable codes are `INVALID_REQUEST`, `CONTEXT_TOO_LARGE`,
`RATE_LIMITED`, `MODEL_ERROR`, `MODEL_TIMEOUT`, and `INTERNAL_ERROR`. Provider
messages and stack traces are never returned to the extension.

Structured request logs contain request ID, method/path, status, duration and a
safe error code. They intentionally exclude API keys, prompts, full snapshots,
conversations, model reasoning and raw provider errors.

## Verification

```bash
npm run typecheck --workspace @contextlayer/api
npm test --workspace @contextlayer/api
npm run check
```

## Structure

```text
src/
├── routes/       # HTTP transport only
├── retrieval/    # candidate selection and context budget
├── ai/           # intent policy, provider, prompts and structured planning
├── validation/   # boundary and target validation
├── config/       # validated environment configuration
└── app.ts        # composition root
tests/
```

The API must not import `@contextlayer/page-engine`, browser globals, DOM types or Chrome APIs.
