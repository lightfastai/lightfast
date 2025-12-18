/**
 * No-op logger implementation for when logging is disabled
 */

import type { ILogger, LogEventContextMap, LogEventName } from "./types";

export class NoopLogger implements ILogger {
	trace(_message: string, _context?: Record<string, any>): void {
		// No-op
	}

	debug(_message: string, _context?: Record<string, any>): void {
		// No-op
	}

	info(_message: string, _context?: Record<string, any>): void {
		// No-op
	}

	warn(_message: string, _context?: Record<string, any>): void {
		// No-op
	}

	error(_message: string, _error?: Error | Record<string, any>): void {
		// No-op
	}

	fatal(_message: string, _error?: Error | Record<string, any>): void {
		// No-op
	}

	logEvent<T extends keyof LogEventContextMap>(
		_eventName: T,
		_context: LogEventContextMap[T],
	): void {
		// No-op
	}

	child(_bindings: Record<string, any>): ILogger {
		return this;
	}
}

// Singleton instance
export const noopLogger = new NoopLogger();
