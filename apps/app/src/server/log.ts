type LogLevel = "info" | "warn" | "error" | "debug";

type LogMetadata = Record<string, unknown>;

function write(level: LogLevel, message: string, metadata?: LogMetadata) {
  try {
    const transport = console[level] ?? console.log;
    if (!metadata || Object.keys(metadata).length === 0) {
      transport.call(console, message);
      return;
    }
    transport.call(console, message, metadata);
  } catch {
    // Logging must never create request failures.
  }
}

export const log = {
  debug: (message: string, metadata?: LogMetadata) =>
    write("debug", message, metadata),
  error: (message: string, metadata?: LogMetadata) =>
    write("error", message, metadata),
  info: (message: string, metadata?: LogMetadata) =>
    write("info", message, metadata),
  warn: (message: string, metadata?: LogMetadata) =>
    write("warn", message, metadata),
};
