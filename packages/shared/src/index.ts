import { z } from "zod";

export const elementKindSchema = z.enum([
  "heading", "paragraph", "section", "article", "comment",
  "card", "list-item", "table-row", "link", "other"
]);

export const semanticElementSchema = z.object({
  id: z.string().regex(/^node-\d{5}$/),
  kind: elementKindSchema,
  text: z.string().min(1).max(4000),
  tagName: z.string().min(1).max(30),
  href: z.string().url().optional(),
  attributes: z.record(z.string()).optional(),
  parentId: z.string().regex(/^node-\d{5}$/).optional(),
  visible: z.boolean(),
  rect: z.object({
    x: z.number(), y: z.number(), width: z.number(), height: z.number()
  }).optional()
});

export const pageSnapshotSchema = z.object({
  contractVersion: z.literal("1"),
  pageId: z.string().min(1),
  snapshotVersion: z.number().int().positive(),
  url: z.string().url(),
  title: z.string().max(500),
  capturedAt: z.number().int().nonnegative(),
  elements: z.array(semanticElementSchema).max(300)
});

export const targetedActionTypeSchema = z.enum([
  "SCROLL_TO", "HIGHLIGHT", "DIM", "STRIKE", "HIDE", "CLEAR_EFFECT", "OPEN_LINK"
]);

export const actionTypeSchema = z.union([targetedActionTypeSchema, z.literal("RESTORE_ALL")]);

const targetedActionSchema = z.object({
  type: targetedActionTypeSchema,
  targetElementIds: z.array(z.string().regex(/^node-\d{5}$/)).min(1).max(50),
  explanation: z.string().max(500).optional()
}).strict();

const restoreAllActionSchema = z.object({
  type: z.literal("RESTORE_ALL"),
  explanation: z.string().max(500).optional()
}).strict();

export const agentActionSchema = z.union([targetedActionSchema, restoreAllActionSchema]);

export const agentResponseSchema = z.object({
  requestId: z.string().uuid(),
  message: z.string().min(1).max(6000),
  references: z.array(z.object({
    elementId: z.string().regex(/^node-\d{5}$/),
    excerpt: z.string().max(500).optional()
  })).max(30).optional(),
  actions: z.array(agentActionSchema).max(20).optional(),
  limitations: z.array(z.string().max(500)).max(10).optional()
});

export const agentRequestSchema = z.object({
  requestId: z.string().uuid(),
  query: z.string().trim().min(1).max(2000),
  page: pageSnapshotSchema
}).strict();

export type SemanticElement = z.infer<typeof semanticElementSchema>;
export type PageSnapshot = z.infer<typeof pageSnapshotSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;

export const actionFailureSchema = z.object({
  elementId: z.string(),
  code: z.enum(["UNKNOWN_ID", "STALE_SNAPSHOT", "DETACHED_NODE", "UNSAFE_TARGET", "UNSUPPORTED"]),
  message: z.string()
}).strict();

export const executionResultSchema = z.object({
  pageId: z.string(),
  snapshotVersion: z.number().int().positive(),
  actionType: actionTypeSchema,
  succeededElementIds: z.array(z.string()),
  failures: z.array(actionFailureSchema)
}).strict();

export const apiErrorSchema = z.object({
  code: z.enum(["INVALID_REQUEST", "CONTEXT_TOO_LARGE", "RATE_LIMITED", "MODEL_ERROR", "MODEL_TIMEOUT", "INTERNAL_ERROR"]),
  message: z.string(),
  requestId: z.string().uuid().optional()
}).strict();

export type ActionFailure = z.infer<typeof actionFailureSchema>;
export type ExecutionResult = z.infer<typeof executionResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

export type ExtensionMessage =
  | { type: "CONTEXTLAYER_QUERY"; payload: AgentRequest }
  | { type: "CONTEXTLAYER_REFRESH" }
  | { type: "CONTEXTLAYER_RESTORE" };
