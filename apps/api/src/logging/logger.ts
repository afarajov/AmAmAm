import type { LogLevel } from "../config/env.js";

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const priorities: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(minimumLevel: LogLevel): Logger {
  const write = (level: LogLevel, message: string, context: LogContext = {}) => {
    if (priorities[level] < priorities[minimumLevel]) return;
    const record = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...context });
    if (level === "error") console.error(record);
    else if (level === "warn") console.warn(record);
    else console.log(record);
  };

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context)
  };
}
