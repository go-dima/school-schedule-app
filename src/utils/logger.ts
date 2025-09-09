/**
 * Browser-compatible logger utility
 * Provides environment-based logging with different levels
 * - Production: error level only
 * - Development: info level by default, debug if VITE_LOG_LEVEL=debug
 */

// Extend environment interface for log level
declare global {
  interface ImportMetaEnv {
    readonly VITE_LOG_LEVEL?: string;
  }
}

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogInfo {
  level: LogLevel;
  message: string;
  meta?: Record<string, any>;
}

// Simple transport interface
interface Transport {
  level: LogLevel;
  log(info: LogInfo): void;
}

// Console transport implementation
class ConsoleTransport implements Transport {
  public readonly level: LogLevel;

  constructor(level: LogLevel) {
    this.level = level;
  }

  public log(info: LogInfo): void {
    const now = new Date();
    const timestamp =
      now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      "." +
      now.getMilliseconds().toString().padStart(3, "0");

    const logMessage = `[${timestamp}] ${info.level.toUpperCase()}: ${info.message}`;

    // Use appropriate console method
    const consoleMethod = console[info.level] || console.log;

    if (info.meta && Object.keys(info.meta).length > 0) {
      consoleMethod(logMessage, info.meta);
    } else {
      consoleMethod(logMessage);
    }
  }
}

// Simple logger class
class Logger {
  private transports: Transport[] = [];

  constructor(transports: Transport[]) {
    this.transports = transports;
  }

  private log(info: LogInfo): void {
    this.transports.forEach(transport => {
      if (transport.level === info.level) {
        transport.log(info);
      }
    });
  }

  public error = (message: string, meta?: Record<string, any>) => {
    this.log({ level: "error", message, meta });
  };

  public warn = (message: string, meta?: Record<string, any>) => {
    this.log({ level: "warn", message, meta });
  };

  public info = (message: string, meta?: Record<string, any>) => {
    this.log({ level: "info", message, meta });
  };

  public debug = (message: string, meta?: Record<string, any>) => {
    this.log({ level: "debug", message, meta });
  };
}

// Create transports based on environment
function createTransports(): Transport[] {
  const isDev = import.meta.env.MODE === "development";
  const customLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() as LogLevel;

  if (!isDev) {
    // Production: only error logs
    return [new ConsoleTransport("error")];
  }

  // Development: info + error by default, or custom level
  if (customLevel === "debug") {
    return [
      new ConsoleTransport("error"),
      new ConsoleTransport("warn"),
      new ConsoleTransport("info"),
      new ConsoleTransport("debug"),
    ];
  }

  return [
    new ConsoleTransport("error"),
    new ConsoleTransport("warn"),
    new ConsoleTransport("info"),
  ];
}

// Create and export logger instance
const logger = new Logger(createTransports());

export const log = {
  error: logger.error,
  warn: logger.warn,
  info: logger.info,
  debug: logger.debug,
};

export default log;
