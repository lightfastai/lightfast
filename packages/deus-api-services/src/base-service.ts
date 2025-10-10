import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import { TRPCError } from "@trpc/server";
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/rpc";

import { createCaller } from "@repo/deus-trpc/server";

export type DeusApiCaller = Awaited<ReturnType<typeof createCaller>>;

export interface DeusApiErrorParams {
  code: TRPC_ERROR_CODE_KEY;
  message: string;
  cause?: unknown;
  status?: number;
  details?: Record<string, unknown>;
}

export class DeusApiError extends Error {
  readonly code: TRPC_ERROR_CODE_KEY;
  readonly status?: number;
  readonly details?: Record<string, unknown>;

  constructor({ code, message, cause, status, details }: DeusApiErrorParams) {
    super(message);
    this.name = "DeusApiError";
    this.code = code;
    this.status = status;
    this.details = details;

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

type CallOptions<T> = {
  fallbackMessage?: string;
  fallbackCode?: TRPC_ERROR_CODE_KEY;
  details?: Record<string, unknown>;
  suppressCodes?: TRPC_ERROR_CODE_KEY[];
  recover?: (error: DeusApiError) => T;
};

const DEFAULT_MESSAGE = "Deus API request failed";
const DEFAULT_CODE: TRPC_ERROR_CODE_KEY = "INTERNAL_SERVER_ERROR";

export abstract class DeusApiService {
  protected async getCaller(): Promise<DeusApiCaller> {
    return createCaller();
  }

  protected async call<T>(
    operation: string,
    fn: (caller: DeusApiCaller) => Promise<T>,
    options: CallOptions<T> = {},
  ): Promise<T> {
    const {
      fallbackMessage = DEFAULT_MESSAGE,
      fallbackCode = DEFAULT_CODE,
      details,
      suppressCodes = [],
      recover,
    } = options;

    try {
      const caller = await this.getCaller();
      return await fn(caller);
    } catch (caughtError) {
      let normalized = this.normalizeError(
        caughtError,
        fallbackMessage,
        fallbackCode,
        details,
      );
      let originalError: unknown = caughtError;

      if (recover) {
        try {
          return recover(normalized);
        } catch (recoverError) {
          originalError = recoverError;
          normalized = this.normalizeError(
            recoverError,
            fallbackMessage,
            fallbackCode,
            details,
          );
        }
      }

      if (!suppressCodes.includes(normalized.code)) {
        this.logError(operation, normalized, details, originalError);
      }

      throw normalized;
    }
  }

  private normalizeError(
    error: unknown,
    fallbackMessage: string,
    fallbackCode: TRPC_ERROR_CODE_KEY,
    details?: Record<string, unknown>,
  ): DeusApiError {
    if (error instanceof DeusApiError) {
      if (details && !error.details) {
        return new DeusApiError({
          code: error.code,
          message: error.message,
          cause: (error as Error & { cause?: unknown }).cause,
          status: error.status,
          details,
        });
      }
      return error;
    }

    if (error instanceof TRPCError) {
      return new DeusApiError({
        code: error.code,
        message: error.message || fallbackMessage,
        cause: error,
        details,
      });
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code in TRPC_ERROR_CODES_BY_KEY
    ) {
      const { code } = error as { code: TRPC_ERROR_CODE_KEY; message?: string };
      const message =
        (error as { message?: string }).message ?? fallbackMessage;
      return new DeusApiError({
        code,
        message,
        cause: error instanceof Error ? error : undefined,
        details,
      });
    }

    if (error instanceof Error) {
      return new DeusApiError({
        code: fallbackCode,
        message: error.message || fallbackMessage,
        cause: error,
        details,
      });
    }

    return new DeusApiError({
      code: fallbackCode,
      message: fallbackMessage,
      details,
    });
  }

  protected logError(
    operation: string,
    error: DeusApiError,
    details?: Record<string, unknown>,
    originalError?: unknown,
  ): void {
    const payload: Record<string, unknown> = {
      code: error.code,
      message: error.message,
      service: this.constructor.name,
      operation,
    };

    if (error.details || details) {
      payload.details = {
        ...(details ?? {}),
        ...(error.details ?? {}),
      };
    }

    if (originalError instanceof Error && originalError.stack) {
      payload.cause = originalError.stack;
    } else if (originalError !== undefined) {
      payload.cause = originalError;
    }

    console.error("[DeusApiService]", payload);
  }
}
