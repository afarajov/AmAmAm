import { Router } from "express";

export function healthRouter(): Router {
  const router = Router();
  router.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "contextlayer-api" });
  });
  return router;
}
