# API workspace — Developer 1

The HTTP boundary and OpenAI-backed structured planning pipeline are implemented.

## Local start

Copy `.env.example` to `.env`, place your API key in `OPENAI_API_KEY`, then run
`npm run dev -w @contextlayer/api` from the repository root. Keep the key only
in `apps/api/.env`; the extension never receives it.

Set `CORS_ALLOWED_ORIGINS` to the extension origin shown by Chrome, for example
`chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef`. Separate multiple local
extension origins with commas.

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

## Structure

```text
src/
├── routes/       # HTTP transport only
├── retrieval/    # candidate selection and context budget
├── ai/           # provider, prompts and structured planning
├── validation/   # boundary and target validation
├── config/       # validated environment configuration
└── app.ts        # composition root
tests/
```

The API must not import `@contextlayer/page-engine`, browser globals, DOM types or Chrome APIs.
