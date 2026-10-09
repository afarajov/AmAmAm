import type { ApiError } from "@contextlayer/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../errors/api-error.js";
import type { Logger } from "../logging/logger.js";

export function notFound(): RequestHandler {
  return (_request, _response, next) => next(new HttpError(404, "INVALID_REQUEST", "Route not found."));
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next): void => {
    const requestId = typeof response.locals.requestId === "string" ? response.locals.requestId : randomUUID();
    response.setHeader("x-request-id", requestId);
    const malformedJson = error instanceof SyntaxError && hasStatus(error, 400);
    const oversizedBody = hasStatus(error, 413);
    const known = error instanceof HttpError;
    const status = oversizedBody ? 413 : malformedJson ? 400 : known ? error.status : 500;
    const body: ApiError = {
      code: oversizedBody ? "CONTEXT_TOO_LARGE" : malformedJson ? "INVALID_REQUEST" : known ? error.code : "INTERNAL_ERROR",
      message: oversizedBody
        ? "The request body exceeds the configured size limit."
        : malformedJson
          ? "The request body is not valid JSON."
          : known
            ? error.message
            : "The request could not be completed.",
      requestId
    };

    if (!known || status >= 500) {
      logger.error("request_failed", {
        requestId,
        status,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
    response.status(status).json(body);
  };
}

function hasStatus(error: unknown, expected: number): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === expected;
}
import { randomUUID } from "node:crypto";
