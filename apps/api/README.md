# API workspace — Developer 1

No backend implementation exists yet.

## Responsibilities

- `POST /api/agent/query` and `GET /health`;
- request validation using `@contextlayer/shared`;
- bounded first-stage retrieval;
- LLM provider adapter and server-side credentials;
- prompt-injection-resistant system instructions;
- structured action planning;
- response schema and element-ID validation;
- timeouts, limits, errors, logging and tests.

## Planned structure

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
