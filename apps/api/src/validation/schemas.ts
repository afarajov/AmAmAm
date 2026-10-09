import type {
  ActionExecutionResult,
  AgentAction,
  AgentRequest,
  AgentResponse,
  ApiError,
  PageSnapshot,
  SemanticElement
} from "@contextlayer/shared";
import { z } from "zod";

export const elementIdSchema = z.string().regex(/^node-\d{5}$/, "Expected a snapshot-local node ID.");

export const elementKindSchema = z.enum([
  "heading", "paragraph", "section", "article", "comment",
  "card", "list-item", "table-row", "link", "other"
]);

export const semanticElementSchema = z.object({
  id: elementIdSchema,
  kind: elementKindSchema,
  text: z.string().trim().min(1).max(4_000),
  tagName: z.string().trim().min(1).max(30),
  href: z.url().optional(),
  attributes: z.record(z.string().max(100), z.string().max(500))
    .refine((attributes) => Object.keys(attributes).length <= 20, "At most 20 attributes are allowed.")
    .optional(),
  parentId: elementIdSchema.optional(),
  visible: z.boolean(),
  rect: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().nonnegative(),
    height: z.number().finite().nonnegative()
  }).strict().optional()
}).strict() satisfies z.ZodType<SemanticElement>;

export const pageSnapshotSchema = z.object({
  contractVersion: z.literal("1"),
  pageId: z.string().trim().min(1).max(200),
  snapshotVersion: z.number().int().positive(),
  url: z.url(),
  title: z.string().max(500),
  capturedAt: z.number().int().nonnegative(),
  elements: z.array(semanticElementSchema).max(300)
}).strict() satisfies z.ZodType<PageSnapshot>;

export const agentActionTypeSchema = z.enum([
  "SCROLL_TO", "HIGHLIGHT", "DIM", "STRIKE", "HIDE", "RESTORE_ALL", "CLEAR_EFFECT"
]);

const targetIdsSchema = z.array(elementIdSchema)
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "Target element IDs must be unique.");

const targetedActionSchema = z.object({
  type: z.enum(["SCROLL_TO", "HIGHLIGHT", "DIM", "STRIKE", "HIDE", "CLEAR_EFFECT"]),
  targetElementIds: targetIdsSchema,
  explanation: z.string().max(500).optional()
}).strict();

const restoreAllActionSchema = z.object({
  type: z.literal("RESTORE_ALL"),
  explanation: z.string().max(500).optional()
}).strict();

export const agentActionSchema = z.union([
  restoreAllActionSchema,
  targetedActionSchema
]) satisfies z.ZodType<AgentAction>;

export const agentRequestSchema = z.object({
  requestId: z.uuid(),
  query: z.string().trim().min(1).max(2_000),
  page: pageSnapshotSchema
}).strict() satisfies z.ZodType<AgentRequest>;

export const agentResponseSchema = z.object({
  requestId: z.uuid(),
  pageId: z.string().trim().min(1).max(200),
  snapshotVersion: z.number().int().positive(),
  message: z.string().trim().min(1).max(6_000),
  references: z.array(z.object({
    elementId: elementIdSchema,
    excerpt: z.string().max(500).optional()
  }).strict()).max(30).optional(),
  actions: z.array(agentActionSchema).max(20),
  limitations: z.array(z.string().trim().min(1).max(500)).max(10).optional()
}).strict() satisfies z.ZodType<AgentResponse>;

export const actionExecutionResultSchema = z.object({
  type: agentActionTypeSchema,
  success: z.boolean(),
  affectedElementIds: z.array(elementIdSchema).max(50),
  failures: z.array(z.object({
    elementId: elementIdSchema.optional(),
    code: z.enum([
      "UNKNOWN_ID", "STALE_SNAPSHOT", "DETACHED_NODE", "UNSAFE_TARGET",
      "UNSUPPORTED_ACTION", "EXECUTION_FAILED"
    ]),
    message: z.string().min(1).max(500)
  }).strict()).max(50)
}).strict() satisfies z.ZodType<ActionExecutionResult>;

export const apiErrorSchema = z.object({
  code: z.enum([
    "INVALID_REQUEST", "CONTEXT_TOO_LARGE", "RATE_LIMITED",
    "MODEL_ERROR", "MODEL_TIMEOUT", "INTERNAL_ERROR"
  ]),
  message: z.string().min(1).max(1_000),
  requestId: z.uuid().optional()
}).strict() satisfies z.ZodType<ApiError>;
