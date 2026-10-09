import type { AgentRequest } from "@contextlayer/shared";
import { Router } from "express";
import type { AgentService } from "../services/agent-service.js";

export function agentQueryRouter(agentService: AgentService): Router {
  const router = Router();
  router.post("/api/agent/query", async (request, response, next) => {
    try {
      // Stage 2 will replace this trust-boundary assertion with runtime validation.
      const result = await agentService.query(request.body as AgentRequest);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
