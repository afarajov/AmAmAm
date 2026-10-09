import { Router } from "express";
import type { AgentService } from "../services/agent-service.js";
import { validateAgentRequest } from "../validation/validate-request.js";
import { validateAgentResponse } from "../validation/validate-response.js";

export function agentQueryRouter(agentService: AgentService): Router {
  const router = Router();
  router.post("/api/agent/query", async (request, response, next) => {
    try {
      const input = validateAgentRequest(request.body);
      const rawResult = await agentService.query(input);
      const result = validateAgentResponse(rawResult, input);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
