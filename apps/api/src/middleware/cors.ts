import type { RequestHandler } from "express";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "content-type, x-request-id";

export function cors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (request, response, next) => {
    const origin = request.headers.origin;
    if (!origin) {
      next();
      return;
    }

    response.vary("Origin");
    if (!allowed.has(origin)) {
      if (request.method === "OPTIONS") {
        response.sendStatus(403);
        return;
      }
      next();
      return;
    }

    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    response.setHeader("Access-Control-Max-Age", "600");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  };
}
