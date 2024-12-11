import type { ErrorFormatter } from "./error-formatter";
import type { Logger } from "./log";

/**
 * A generic async executor that can handle different operation types and keys/paths.
 */
export class AsyncExecutor<OperationType extends string, KeyType> {
  constructor(
    private readonly operation: OperationType,
    private readonly key: KeyType,
    private readonly logger?: Logger,
    private readonly errorFormatter?: ErrorFormatter,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.logger?.debug(`${this.operation} succeeded`, {
        operation: this.operation,
        key: this.key,
      });
      return result;
    } catch (error) {
      const formattedError = this.errorFormatter
        ? this.errorFormatter.format(error)
        : { error };

      this.logger?.error(`${this.operation} failed`, {
        operation: this.operation,
        key: this.key,
        ...formattedError,
      });
      throw error;
    }
  }
}
