import "server-only";

import { captureException, flush } from "@sentry/core";
import { Middleware, NonRetriableError } from "@vendor/inngest";

import type { RequestContext } from "./context";
import { requestStore } from "./context";
import { log } from "./log/next";

interface RunContext {
  correlationId: string;
  eventName?: string;
  fnId: string;
  requestContext: RequestContext;
  startTime: number;
}

/**
 * Extracts common context fields from Inngest event data.
 * Filters out undefined values so ALS context stays clean.
 */
function extractEventContext(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!data) {
    return {};
  }

  const fields: Record<string, unknown> = {
    correlationId: data.correlationId,
    provider: data.provider,
    clerkOrgId: data.clerkOrgId ?? data.orgId,
    installationId: data.installationId,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getEventData(ctx: Middleware.OnRunStartArgs["ctx"]) {
  return typeof ctx.event?.data === "object" && ctx.event.data !== null
    ? (ctx.event.data as Record<string, unknown>)
    : undefined;
}

class LightfastInngestObservabilityMiddleware extends Middleware.BaseMiddleware {
  readonly id = "lightfast:observability";

  private runContext?: RunContext;

  private ensureRunContext(
    ctx: Middleware.OnRunStartArgs["ctx"],
    fn: Middleware.OnRunStartArgs["fn"]
  ): RunContext {
    if (this.runContext) {
      return this.runContext;
    }

    const fnId = fn.id();
    const eventData = getEventData(ctx);
    const eventContext = extractEventContext(eventData);
    const correlationId =
      (eventContext.correlationId as string | undefined) ?? ctx.runId;
    const eventName =
      typeof ctx.event?.name === "string" ? ctx.event.name : undefined;

    this.runContext = {
      correlationId,
      eventName,
      fnId,
      requestContext: {
        requestId: ctx.runId,
        inngestFunctionId: fnId,
        ...(eventName && { inngestEventName: eventName }),
        ...eventContext,
        correlationId,
      },
      startTime: Date.now(),
    };

    return this.runContext;
  }

  onMemoizationEnd({ ctx, fn }: Middleware.OnMemoizationEndArgs) {
    const { requestContext } = this.ensureRunContext(ctx, fn);
    requestStore.enterWith(requestContext);
  }

  async wrapFunctionHandler({
    ctx,
    fn,
    next,
  }: Middleware.WrapFunctionHandlerArgs) {
    const { requestContext } = this.ensureRunContext(ctx, fn);
    return requestStore.run(requestContext, () => next());
  }

  onRunComplete({ ctx, fn }: Middleware.OnRunCompleteArgs) {
    const runContext = this.ensureRunContext(ctx, fn);
    const durationMs = Date.now() - runContext.startTime;

    log.info(`[inngest] ${runContext.fnId} completed`, {
      durationMs,
    });
  }

  async onRunError({
    ctx,
    error,
    fn,
    isFinalAttempt,
  }: Middleware.OnRunErrorArgs) {
    const runContext = this.ensureRunContext(ctx, fn);
    const durationMs = Date.now() - runContext.startTime;
    const isBusinessError = error instanceof NonRetriableError;
    const errorMessage = getErrorMessage(error);

    if (isBusinessError) {
      log.info(`[inngest] ${runContext.fnId} rejected`, {
        durationMs,
        error: errorMessage,
        isFinalAttempt,
      });
    } else {
      const reportedError =
        error instanceof Error && error.cause instanceof Error
          ? error.cause
          : error;

      captureException(reportedError, {
        extra: {
          correlationId: runContext.correlationId,
          durationMs,
          isFinalAttempt,
        },
        tags: {
          "inngest.function.id": runContext.fnId,
          "inngest.run.id": ctx.runId,
          ...(runContext.eventName && {
            "inngest.event.name": runContext.eventName,
          }),
        },
      });

      log.error(`[inngest] ${runContext.fnId} failed`, {
        durationMs,
        error: errorMessage,
        isFinalAttempt,
      });
    }

    await flush(2000);
  }
}

export function createInngestObservabilityMiddleware(): Middleware.Class {
  return LightfastInngestObservabilityMiddleware;
}
