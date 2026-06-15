import { getActiveSpan } from "@sentry/nextjs";

export function getAuthTraceContext(): Record<string, string> {
  const span = getActiveSpan();
  if (!span) {
    return {};
  }
  const { traceId, spanId } = span.spanContext();
  return { sentryTraceId: traceId, sentrySpanId: spanId };
}
