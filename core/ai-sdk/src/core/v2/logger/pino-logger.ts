/**
 * Pino implementation of the logger interface
 */

import type { Logger as PinoLogger } from "pino";
import type {
	ILogger,
	LogEventContextMap,
	LogEventName,
	LoggerFactory,
} from "./types";

export class PinoLoggerAdapter implements ILogger {
	constructor(private readonly pino: PinoLogger) {}

	trace(message: string, context?: Record<string, any>): void {
		this.pino.trace(context, message);
	}

	debug(message: string, context?: Record<string, any>): void {
		this.pino.debug(context, message);
	}

	info(message: string, context?: Record<string, any>): void {
		this.pino.info(context, message);
	}

	warn(message: string, context?: Record<string, any>): void {
		this.pino.warn(context, message);
	}

	error(message: string, error?: Error | Record<string, any>): void {
		if (error instanceof Error) {
			this.pino.error({ err: error }, message);
		} else {
			this.pino.error(error, message);
		}
	}

	fatal(message: string, error?: Error | Record<string, any>): void {
		if (error instanceof Error) {
			this.pino.fatal({ err: error }, message);
		} else {
			this.pino.fatal(error, message);
		}
	}

	logEvent<T extends keyof LogEventContextMap>(
		eventName: T,
		context: LogEventContextMap[T],
	): void {
		// Log events at info level with event name and full context
		// Explicitly type the object to satisfy Pino's type system
		const logData: Record<string, any> = {
			event: eventName,
			...context,
		};
		this.pino.info(logData);
	}

	child(bindings: Record<string, any>): ILogger {
		return new PinoLoggerAdapter(this.pino.child(bindings));
	}
}

/**
 * Create a logger factory that uses pino
 */
export function createPinoLoggerFactory(basePino: PinoLogger): LoggerFactory {
	return (context) => {
		const childLogger = basePino.child({
			sessionId: context.sessionId,
			agentId: context.agentId,
			userId: context.userId,
			traceId: context.traceId,
		});

		return new PinoLoggerAdapter(childLogger);
	};
}
