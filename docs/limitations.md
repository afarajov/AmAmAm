# Known limitations

- ContextLayer understands only the currently rendered page snapshot, not the whole website.
- Extraction is text/attribute based; image-only properties and canvas content require vision support.
- Cross-origin frames, closed Shadow DOM, restricted browser pages, and virtualized off-screen items may be unavailable.
- Highly dynamic SPAs can invalidate a snapshot; manual refresh is the reliable recovery path in this MVP.
- The heuristic extractor cannot infer every website's ideal semantic card boundary.
- Candidate retrieval is lexical before model reasoning, so distant paraphrases can be missed on pages that exceed the direct context budget.
- AI classification and grounded answers can still be wrong. References make inspection easier but are not proof of correctness.
- Hiding a poorly chosen layout block can alter page spacing, although reset remains available.
- Visual effects are local and temporary; they are not persisted across navigation/reload.
- Backend availability, model quotas, and provider latency will affect AI-assisted requests.
