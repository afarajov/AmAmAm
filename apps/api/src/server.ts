import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./logging/logger.js";
import { PlanningAgentService, UnavailableAgentService } from "./services/agent-service.js";
import { OpenAIResponsesPlanner } from "./ai/openai-agent-planner.js";
import { OpenAIEmbeddingProvider } from "./retrieval/openai-embedding-provider.js";
import { selectSemanticCandidateElements } from "./retrieval/select-candidates.js";

const config = loadConfig();
const logger = createLogger(config.logLevel);
const embeddingProvider = config.openaiApiKey
  ? new OpenAIEmbeddingProvider(
      config.openaiApiKey,
      config.openaiEmbeddingModel,
      config.openaiTimeoutMs
    )
  : undefined;
const agentService = config.openaiApiKey
  ? new PlanningAgentService(
      new OpenAIResponsesPlanner(config.openaiApiKey, config.openaiModel, config.openaiTimeoutMs),
      (query, elements) => selectSemanticCandidateElements(
        query,
        elements,
        embeddingProvider!
      )
    )
  : new UnavailableAgentService();
const app = createApp({ config, logger, agentService });
const server = createServer(app);

server.listen(config.port, config.host, () => {
  logger.info("server_started", { host: config.host, port: config.port });
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("server_shutdown_started", { signal });

  const forceExit = setTimeout(() => {
    logger.error("server_shutdown_timed_out", { timeoutMs: config.shutdownTimeoutMs });
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);
    if (error) {
      logger.error("server_shutdown_failed", { error: error.message });
      process.exitCode = 1;
    } else {
      logger.info("server_stopped");
      process.exitCode = 0;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
