import { Router } from "express";

export interface ReadinessState {
  configured: boolean;
}

export function healthRouter(readiness: ReadinessState): Router {
  const router = Router();
  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "contextlayer-api" });
  });
  router.get("/ready", (_request, response) => {
    if (!readiness.configured) {
      response.status(503).json({ status: "not_ready", service: "contextlayer-api" });
      return;
    }
    response.json({ status: "ready", service: "contextlayer-api" });
  });
  return router;
}
