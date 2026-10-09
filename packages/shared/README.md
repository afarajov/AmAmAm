# Shared contracts — Developer 1

This package provides the stable `@contextlayer/shared` import path. It re-exports the serializable TypeScript contract from `/shared/types.ts` and contains no application behavior.

Rules:

- no application behavior;
- no DOM/Chrome/Node framework imports;
- backward-incompatible changes must be announced to both downstream owners;
- runtime schemas and TypeScript types must remain derived from one source;
- all wire values must be JSON-serializable.
