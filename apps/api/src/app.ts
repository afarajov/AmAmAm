import express, { type Express } from "express";
import type { ApiConfig } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import type { Logger } from "./logging/logger.js";
import { agentQueryRouter } from "./routes/agent-query.js";
import { healthRouter } from "./routes/health.js";
import type { AgentService } from "./services/agent-service.js";
import { cors } from "./middleware/cors.js";

export interface AppDependencies {
  config: Pick<ApiConfig, "jsonBodyLimit" | "corsAllowedOrigins">;
  logger: Logger;
  agentService: AgentService;
}

export function createApp({ config, logger, agentService }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors(config.corsAllowedOrigins));
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(requestContext(logger));
  app.use(healthRouter());
  app.use(agentQueryRouter(agentService));
  app.use(notFound());
  app.use(errorHandler(logger));
  return app;
}
