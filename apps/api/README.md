# API workspace — Developer 1

The HTTP boundary and OpenAI-backed structured planning pipeline are implemented.

## Local start

Copy `.env.example` to `.env`, place your API key in `OPENAI_API_KEY`, then run
`npm run dev -w @contextlayer/api` from the repository root. Keep the key only
in `apps/api/.env`; the extension never receives it.

Set `CORS_ALLOWED_ORIGINS` to the extension origin shown by Chrome, for example
`chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef`. Separate multiple local
extension origins with commas.

## Responsibilities

- `POST /api/agent/query` and `GET /health`;
- request validation using `@contextlayer/shared`;
- bounded first-stage retrieval;
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
