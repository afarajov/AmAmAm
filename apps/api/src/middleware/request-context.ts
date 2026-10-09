import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "../logging/logger.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestContext(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const bodyRequestId = isRecord(request.body) && typeof request.body.requestId === "string"
      ? request.body.requestId
      : undefined;
    const headerRequestId = request.header("x-request-id");
    const candidate = bodyRequestId ?? headerRequestId;
    const requestId = candidate && UUID_PATTERN.test(candidate) ? candidate : randomUUID();
    const startedAt = performance.now();

    response.locals.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      logger.info("request_completed", {
        requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        ...(typeof response.locals.errorCode === "string"
          ? { errorCode: response.locals.errorCode }
          : {}),
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100
      });
    });
    next();
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
