import "server-only";

import { flush, withIsolationScope } from "@sentry/core";
import { Middleware, NonRetriableError } from "@vendor/inngest";

import type { JournalEntry, RequestStore } from "./context";
import { createStore, requestStore } from "./context";
import { log } from "./log/next";

const MAX_JOURNAL_ENTRIES = 50;

interface RunContext {
  correlationId: string;
  eventName?: string;
  fnId: string;
  startTime: number;
  store: RequestStore;
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

function getStepName(stepInfo: {
  options: { id: string; name?: string | undefined };
}): string {
  return stepInfo.options.name ?? stepInfo.options.id;
}

class LightfastInngestObservabilityMiddleware extends Middleware.BaseMiddleware {
  readonly id = "lightfast:observability";

  private runContext?: RunContext;
  private readonly stepStartTimes = new Map<string, number>();

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

    const store = createStore({
      requestId: ctx.runId,
      inngestFunctionId: fnId,
      ...(eventName && { inngestEventName: eventName }),
      ...eventContext,
      correlationId,
    });

    this.runContext = {
      correlationId,
      eventName,
      fnId,
      startTime: Date.now(),
      store,
    };
    this.journal("info", "function:start");

    return this.runContext;
  }

  private journal(
    level: JournalEntry["level"],
    msg: string,
    meta?: Record<string, unknown>
  ) {
    const store = this.runContext?.store;
    if (!store || store.journal.length >= MAX_JOURNAL_ENTRIES) {
      return;
    }
    store.journal.push({ ts: Date.now(), level, msg, meta });
  }

  private emitJournal(durationMs: number) {
    const store = this.runContext?.store;
    const fnId = this.runContext?.fnId;
    if (!(store && fnId) || store.journal.length === 0) {
      return;
    }

    log.info(`[inngest] ${fnId} journal`, {
      durationMs,
      entryCount: store.journal.length,
      entries: store.journal,
    });
  }

  onMemoizationEnd({ ctx, fn }: Middleware.OnMemoizationEndArgs) {
    const { store } = this.ensureRunContext(ctx, fn);
    requestStore.enterWith(store);
  }

  async wrapFunctionHandler({
    ctx,
    fn,
    next,
  }: Middleware.WrapFunctionHandlerArgs) {
    const { store } = this.ensureRunContext(ctx, fn);
    return requestStore.run(store, () => next());
  }

  onStepStart({ ctx, fn, stepInfo }: Middleware.OnStepStartArgs) {
    this.ensureRunContext(ctx, fn);
    const stepName = getStepName(stepInfo);
    this.stepStartTimes.set(stepInfo.hashedId, Date.now());
    this.journal("info", "step:start", {
      stepName,
      stepType: stepInfo.stepType,
    });
  }

  onStepComplete({ ctx, fn, stepInfo }: Middleware.OnStepCompleteArgs) {
    this.ensureRunContext(ctx, fn);
    const startedAt = this.stepStartTimes.get(stepInfo.hashedId);
    const durationMs = startedAt ? Date.now() - startedAt : undefined;
    this.journal("info", "step:done", {
      ...(durationMs !== undefined && { durationMs }),
      stepName: getStepName(stepInfo),
      stepType: stepInfo.stepType,
    });
  }

  onStepError({
    ctx,
    error,
    fn,
    isFinalAttempt,
    stepInfo,
  }: Middleware.OnStepErrorArgs) {
    this.ensureRunContext(ctx, fn);
    const startedAt = this.stepStartTimes.get(stepInfo.hashedId);
    const durationMs = startedAt ? Date.now() - startedAt : undefined;
    this.journal("error", "step:error", {
      ...(durationMs !== undefined && { durationMs }),
      error: getErrorMessage(error),
      isFinalAttempt,
      stepName: getStepName(stepInfo),
      stepType: stepInfo.stepType,
    });
  }

  onRunComplete({ ctx, fn }: Middleware.OnRunCompleteArgs) {
    const runContext = this.ensureRunContext(ctx, fn);
    const durationMs = Date.now() - runContext.startTime;

    this.journal("info", "function:done", { durationMs });
    log.info(`[inngest] ${runContext.fnId} completed`, {
      durationMs,
      steps: runContext.store.journal.length,
    });
    this.emitJournal(durationMs);
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

    this.journal("error", "function:error", {
      durationMs,
      error: errorMessage,
      isBusinessError,
      isFinalAttempt,
    });

    if (isBusinessError) {
      log.info(`[inngest] ${runContext.fnId} rejected`, {
        durationMs,
        error: errorMessage,
        isFinalAttempt,
      });
    } else {
      withIsolationScope((scope) => {
        scope.setTag("inngest.function.id", runContext.fnId);
        scope.setTag("inngest.run.id", ctx.runId);
        if (runContext.eventName) {
          scope.setTag("inngest.event.name", runContext.eventName);
        }
        scope.setTransactionName(`inngest:${runContext.fnId}`);
        scope.setExtra("correlationId", runContext.correlationId);
        scope.setExtra("durationMs", durationMs);
        scope.setExtra("isFinalAttempt", isFinalAttempt);

        const reportedError =
          error instanceof Error && error.cause instanceof Error
            ? error.cause
            : error;

        scope.captureException(reportedError, {
          mechanism: {
            handled: false,
            type: "auto.function.inngest.middleware",
          },
        });
      });

      log.error(`[inngest] ${runContext.fnId} failed`, {
        durationMs,
        error: errorMessage,
        isFinalAttempt,
      });
    }

    this.emitJournal(durationMs);
    await flush(2000);
  }
}

export function createInngestObservabilityMiddleware(): Middleware.Class {
  return LightfastInngestObservabilityMiddleware;
}
