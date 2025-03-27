import { parseError } from "./error";

export interface ErrorContext {
  level: string;
  [key: string]: unknown;
}

export class ErrorFormatter {
  constructor(
    private readonly level: string,
    private readonly context: Record<string, unknown> = {},
  ) {}

  format(error: unknown) {
    const baseError = this.formatError(error);
    return {
      ...baseError,
      ...this.context,
      level: this.level,
    };
  }

  protected formatError(error: unknown): Record<string, unknown> {
    return { error: parseError(error) };
  }

  withContext(context: Record<string, unknown>) {
    return new ErrorFormatter(this.level, {
      ...this.context,
      ...context,
    });
  }
}

export class TypedErrorFormatter<T extends Error> extends ErrorFormatter {
  constructor(
    private readonly errorType: new (...args: any[]) => T,
    level: string,
    context: Record<string, unknown> = {},
  ) {
    super(level, context);
  }

  protected formatError(error: unknown): Record<string, unknown> {
    if (error instanceof this.errorType) {
      return {
        message: error.message,
        name: error.name,
        type: error.constructor.name,
      };
    }
    return super.formatError(error);
  }
}
