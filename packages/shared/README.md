# Shared contracts — Developer 1

This is the only implemented package in the architecture foundation. It defines the serializable types and Zod schemas required for parallel development.

Rules:

- no application behavior;
- no DOM/Chrome/Node framework imports;
- backward-incompatible changes must be announced to both downstream owners;
- runtime schemas and TypeScript types must remain derived from one source;
- all wire values must be JSON-serializable.
