export interface PageEngineOptions {
  /** Maximum number of semantic blocks included in one snapshot. */
  maxElements?: number;
  /** Maximum combined number of normalized text characters. */
  maxTotalTextLength?: number;
  /** Maximum text length of one semantic block. */
  maxElementTextLength?: number;
  /** Attribute used by the client to mark UI that extraction must ignore. */
  ignoredUiAttribute?: string;
}

export interface ResolvedPageEngineOptions {
  maxElements: number;
  maxTotalTextLength: number;
  maxElementTextLength: number;
  ignoredUiAttribute: string;
}

export const DEFAULT_OPTIONS: ResolvedPageEngineOptions = {
  maxElements: 200,
  maxTotalTextLength: 30_000,
  maxElementTextLength: 2_000,
  ignoredUiAttribute: "data-contextlayer-ui",
};

export function resolveOptions(
  options: PageEngineOptions = {},
): ResolvedPageEngineOptions {
  return {
    maxElements: positiveInteger(options.maxElements, DEFAULT_OPTIONS.maxElements),
    maxTotalTextLength: positiveInteger(
      options.maxTotalTextLength,
      DEFAULT_OPTIONS.maxTotalTextLength,
    ),
    maxElementTextLength: positiveInteger(
      options.maxElementTextLength,
      DEFAULT_OPTIONS.maxElementTextLength,
    ),
    ignoredUiAttribute:
      options.ignoredUiAttribute?.trim() || DEFAULT_OPTIONS.ignoredUiAttribute,
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value !== undefined && value > 0
    ? value
    : fallback;
}
