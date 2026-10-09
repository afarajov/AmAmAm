import type { ApiError } from "@contextlayer/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../errors/api-error.js";
import type { Logger } from "../logging/logger.js";

export function notFound(): RequestHandler {
  return (_request, _response, next) => next(new HttpError(404, "INVALID_REQUEST", "Route not found."));
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _request, response, _next): void => {
    const requestId = typeof response.locals.requestId === "string" ? response.locals.requestId : undefined;
    const known = error instanceof HttpError;
    const status = known ? error.status : 500;
    const body: ApiError = {
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "The request could not be completed.",
      ...(requestId ? { requestId } : {})
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
