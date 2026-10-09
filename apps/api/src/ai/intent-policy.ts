import type { AgentActionType } from "@contextlayer/shared";

export type QueryIntent =
  | { kind: "FACTUAL"; requiredActions: readonly [] }
  | { kind: "AMBIGUOUS_ACTION"; requiredActions: readonly AgentActionType[] }
  | { kind: "ACTION"; requiredActions: readonly AgentActionType[] };

const RESTORE_ALL_PATTERNS = [
  /\b(?:restore|reset|undo)\s+(?:the\s+)?(?:whole\s+)?(?:page|everything|all(?:\s+(?:changes|effects))?)\b/iu,
  /(?:^|[^\p{L}])(?:верн(?:и|ите)|восстанов(?:и|ите)|сброс(?:ь|ьте)|отмен(?:и|ите))\s+(?:всю\s+страницу|всё|все\s+(?:изменения|эффекты))(?:$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:hamısını|hər\s+şeyi)\s+(?:bərpa|sıfırla)[\p{L}]*/iu
];

const CLEAR_EFFECT_PATTERNS = [
  /\b(?:clear|remove)\s+(?:the\s+)?(?:visual\s+)?effects?\b/iu,
  /\bremove\s+(?:the\s+)?(?:highlight|dimming|strikethrough)\b/iu,
  /(?:^|[^\p{L}])(?:убер(?:и|ите)|сним(?:и|ите|ать)|очист(?:и|ите|ить))\s+(?:эффект|подсвет|выделен|затемнен|затемнён|зачеркиван)[\p{L}]*/iu,
  /(?:^|[^\p{L}])(?:effekti|vurğulamanı)\s+(?:sil|təmizlə)[\p{L}]*/iu
];

const ACTION_PATTERNS: ReadonlyArray<{
  type: Exclude<AgentActionType, "RESTORE_ALL" | "CLEAR_EFFECT">;
  patterns: readonly RegExp[];
}> = [
  {
    type: "HIGHLIGHT",
    patterns: [
      /\bhighlight\b/iu,
      /(?:^|[^\p{L}])(?:подсвет(?:и|ите|ить)|выдел(?:и|ите|ить))(?:$|[^\p{L}])/iu,
      /(?:^|[^\p{L}])vurğula[\p{L}]*/iu
    ]
  },
  {
    type: "DIM",
    patterns: [
      /\b(?:dim|fade|deemphasize)\b/iu,
      /(?:^|[^\p{L}])(?:затемн(?:и|ите|ить)|приглуш(?:и|ите|ить))(?:$|[^\p{L}])/iu,
      /(?:^|[^\p{L}])solğunlaşdır[\p{L}]*/iu
    ]
  },
  {
    type: "STRIKE",
    patterns: [
      /\b(?:strike|cross)\s*(?:out|through)?\b/iu,
      /(?:^|[^\p{L}])зачеркн(?:и|ите|уть)(?:$|[^\p{L}])/iu,
      /(?:^|[^\p{L}])üstündən\s+xətt\s+çək[\p{L}]*/iu
    ]
  },
  {
    type: "HIDE",
    patterns: [
      /\b(?:hide|conceal|delete)\b/iu,
      /\bremove\b(?!\s+(?:the\s+)?(?:(?:visual\s+)?effects?|highlight|dimming|strikethrough)\b)/iu,
      /(?:^|[^\p{L}])скр(?:ой|ойте|ыть)(?:$|[^\p{L}])/iu,
      /(?:^|[^\p{L}])gizlət[\p{L}]*/iu
    ]
  },
  {
    type: "SCROLL_TO",
    patterns: [
      /\bscroll\s+(?:me\s+)?to\b/iu,
      /\b(?:go|take)\s+(?:me\s+)?to\b/iu,
      /(?:^|[^\p{L}])(?:прокрут(?:и|ите|ить)|перейд(?:и|ите))\s+(?:меня\s+)?к/iu,
      /(?:^|[^\p{L}])(?:sürüşdür|keç)[\p{L}]*\s+(?:məni\s+)?(?:ora|hissəyə|bölməyə)/iu
    ]
  }
];

const LOCATE_PATTERNS = [
  /\b(?:show|locate|find)\s+(?:me\s+)?(?:where|the\s+(?:passage|paragraph|section|part|item))/iu,
  /(?:^|[^\p{L}])(?:покаж(?:и|ите)|найд(?:и|ите))\s+(?:мне\s+)?(?:где|абзац|раздел|часть|фрагмент)/iu,
  /(?:^|[^\p{L}])(?:göstər|tap)[\p{L}]*\s+(?:mənə\s+)?(?:harada|hissə|abzas|bölmə)/iu
];

const AMBIGUOUS_TARGET_PATTERNS = [
  /^(?:please\s+)?(?:highlight|dim|fade|hide|conceal|remove|delete|strike(?:\s+out)?|cross\s+out|scroll(?:\s+to)?|show|locate|find|clear\s+(?:the\s+)?effect(?:s)?(?:\s+(?:from|on))?|remove\s+(?:the\s+)?effect(?:s)?(?:\s+(?:from|on))?)\s+(?:this|that|it|these|those)(?:\s+(?:one|ones|element|section|paragraph|item))?[.!?]*$/iu,
  /^(?:пожалуйста,?\s+)?(?:подсвет\p{L}*|выдел\p{L}*|затемн\p{L}*|приглуш\p{L}*|зачерк\p{L}*|скр(?:ой|ыть|ывай)\p{L}*|прокрут\p{L}*|покаж\p{L}*|найд\p{L}*|убер\p{L}*\s+эффект\p{L}*)\s+(?:это|этот|эту|эти|его|её|их)(?:\s+(?:элемент|раздел|абзац|часть))?[.!?]*$/iu,
  /^(?:zəhmət\s+olmasa\s+)?(?:vurğula\p{L}*|gizlət\p{L}*|sürüşdür\p{L}*|göstər\p{L}*|tap\p{L}*)\s+(?:bunu|onu|bunları|onları)[.!?]*$/iu
];

export function classifyQueryIntent(query: string): QueryIntent {
  if (matchesAny(query, RESTORE_ALL_PATTERNS)) {
    return { kind: "ACTION", requiredActions: ["RESTORE_ALL"] };
  }

  const requested = new Set<AgentActionType>();
  if (matchesAny(query, CLEAR_EFFECT_PATTERNS)) requested.add("CLEAR_EFFECT");
  for (const action of ACTION_PATTERNS) {
    if (matchesAny(query, action.patterns)) requested.add(action.type);
  }
  if (matchesAny(query, LOCATE_PATTERNS)) {
    requested.add("HIGHLIGHT");
    requested.add("SCROLL_TO");
  }

  if (requested.size === 0) return { kind: "FACTUAL", requiredActions: [] };
  const requiredActions = [...requested];
  if (matchesAny(query.trim(), AMBIGUOUS_TARGET_PATTERNS)) {
    return { kind: "AMBIGUOUS_ACTION", requiredActions };
  }
  return { kind: "ACTION", requiredActions };
}

export function isVisualOperationIntent(intent: QueryIntent): boolean {
  return intent.kind !== "FACTUAL";
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}
