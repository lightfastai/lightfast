import type { ErrorFormatter } from "./error-formatter";
import type { Logger } from "./log";

/**
 * A generic async executor that can handle different event types and keys/paths.
 */
export class AsyncExecutor<EventType extends string, KeyType> {
  constructor(
    private readonly event: EventType,
    private readonly key: KeyType,
    private readonly logger?: Logger,
    private readonly errorFormatter?: ErrorFormatter,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.logger?.debug(this.event, {
        msg: this.event,
        status: "success",
        key: this.key,
      });
      return result;
    } catch (error) {
      const formattedError = this.errorFormatter
        ? this.errorFormatter.format(error)
        : { error };

      this.logger?.error(this.event, {
        msg: this.event,
        status: "failed",
        key: this.key,
        ...formattedError,
      });
      throw error;
    }
  }
}
