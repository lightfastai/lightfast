import type { PostTransformEvent } from "../../contracts/event";
import type { TransformContext } from "../../provider/primitives";
import { sanitizeBody, sanitizeTitle } from "../../runtime/sanitize";
import {
  logValidationErrors,
  validatePostTransformEvent,
} from "../../runtime/validation";
import type {
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryIssueWebhook,
  PreTransformSentryMetricAlertWebhook,
} from "./schemas";

export function transformSentryIssue(
  payload: PreTransformSentryIssueWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const { issue } = payload.data;

  const actionTitles: Record<string, string> = {
    created: "Issue Created",
    resolved: "Issue Resolved",
    assigned: "Issue Assigned",
    ignored: "Issue Ignored",
    archived: "Issue Archived",
    unresolved: "Issue Unresolved",
  };

  const errorType = issue.metadata.type ?? "Error";
  const errorValue = issue.metadata.value ?? issue.title;
  const location = issue.metadata.filename
    ? `in ${issue.metadata.filename}`
    : issue.culprit
      ? `in ${issue.culprit}`
      : "";

  const bodyParts = [
    issue.title,
    issue.metadata.value,
    location ? `Location: ${location}` : "",
    issue.metadata.function ? `Function: ${issue.metadata.function}` : "",
    `Level: ${issue.level}`,
    `Platform: ${issue.platform}`,
    `Occurrences: ${issue.count}`,
    `Users affected: ${issue.userCount}`,
  ].filter(Boolean);

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `sentry:issue:${issue.project.id}:${issue.shortId}:issue.${payload.action}`,
    provider: "sentry",
    eventType: `issue.${payload.action}`,
    title: sanitizeTitle(
      `[${actionTitles[payload.action]}] ${errorType}: ${errorValue.slice(0, 80)}`
    ),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: issue.lastSeen,
    entity: {
      provider: "sentry",
      entityType: "issue",
      entityId: `${issue.project.id}:${issue.shortId}`,
      title: issue.title,
      url: issue.permalink,
      state: issue.status,
    },
    relations: [],
    attributes: {
      projectId: issue.project.id,
      projectSlug: issue.project.slug,
      projectName: issue.project.name,
      issueId: issue.id,
      shortId: issue.shortId,
      level: issue.level,
      platform: issue.platform,
      errorType: issue.metadata.type ?? null,
      errorValue: issue.metadata.value ?? null,
      filename: issue.metadata.filename ?? null,
      culprit: issue.culprit,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      status: issue.status,
      action: payload.action,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryIssue", event, validation.errors);
  }

  return event;
}

export function transformSentryError(
  payload: PreTransformSentryErrorWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const { error: errorEvent } = payload.data;

  const stackInfo =
    errorEvent.exception?.values
      .map((exc) => {
        const topFrame = exc.stacktrace?.frames.slice(-1)[0];
        return topFrame
          ? `${exc.type} at ${topFrame.filename}:${topFrame.lineno} in ${topFrame.function}`
          : `${exc.type}: ${exc.value}`;
      })
      .join("\n") ?? "";

  const errorType = errorEvent.metadata.type ?? "Error";
  const errorValue = errorEvent.metadata.value ?? errorEvent.title;

  const bodyParts = [
    errorEvent.title,
    errorEvent.message,
    errorEvent.metadata.value,
    errorEvent.location ? `Location: ${errorEvent.location}` : "",
    stackInfo,
    `Platform: ${errorEvent.platform}`,
  ].filter(Boolean);

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `sentry:error:${errorEvent.project}:${errorEvent.event_id}:error.created`,
    provider: "sentry",
    eventType: "error.created",
    title: sanitizeTitle(`[Error] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt:
      typeof errorEvent.timestamp === "number"
        ? new Date(errorEvent.timestamp * 1000).toISOString()
        : errorEvent.timestamp,
    entity: {
      provider: "sentry",
      entityType: "error",
      entityId: `${errorEvent.project}:${errorEvent.event_id}`,
      title: errorEvent.title,
      url: errorEvent.web_url ?? null,
      state: null,
    },
    relations: [],
    attributes: {
      projectId: errorEvent.project,
      eventId: errorEvent.event_id,
      platform: errorEvent.platform,
      errorType: errorEvent.metadata.type ?? null,
      errorValue: errorEvent.metadata.value ?? null,
      filename: errorEvent.metadata.filename ?? null,
      location: errorEvent.location ?? null,
      culprit: errorEvent.culprit ?? null,
      installationId: payload.installation.uuid,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryError", event, validation.errors);
  }

  return event;
}

export function transformSentryEventAlert(
  payload: PreTransformSentryEventAlertWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const { event, triggered_rule } = payload.data;

  const errorType = event.metadata.type ?? "Alert";
  const errorValue = event.metadata.value ?? event.title;

  const bodyParts = [
    `Alert Rule: ${triggered_rule}`,
    event.title,
    event.message,
    event.metadata.value,
    `Platform: ${event.platform}`,
  ].filter(Boolean);

  const eventOut: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `sentry:alert:${event.project}:${event.event_id}:event-alert.triggered`,
    provider: "sentry",
    eventType: "event-alert.triggered",
    title: sanitizeTitle(`[Alert Triggered] ${triggered_rule}: ${errorType}`),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt:
      typeof event.timestamp === "number"
        ? new Date(event.timestamp * 1000).toISOString()
        : event.timestamp,
    entity: {
      provider: "sentry",
      entityType: "alert",
      entityId: `${event.project}:${event.event_id}`,
      title: `${triggered_rule}: ${errorValue}`,
      url: event.web_url ?? null,
      state: null,
    },
    relations: [],
    attributes: {
      projectId: event.project,
      eventId: event.event_id,
      triggeredRule: triggered_rule,
      platform: event.platform,
      errorType: event.metadata.type ?? null,
      errorValue,
      installationId: payload.installation.uuid,
    },
  };

  const validation = validatePostTransformEvent(eventOut);
  if (!validation.success && validation.errors) {
    logValidationErrors(
      "transformSentryEventAlert",
      eventOut,
      validation.errors
    );
  }

  return eventOut;
}

export function transformSentryMetricAlert(
  payload: PreTransformSentryMetricAlertWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const { metric_alert } = payload.data;
  const alertRule = metric_alert.alert_rule;

  const metricActionTitles: Record<string, string> = {
    critical: "Metric Alert Critical",
    warning: "Metric Alert Warning",
    resolved: "Metric Alert Resolved",
  };
  const actionTitle = metricActionTitles[payload.action] ?? "Metric Alert";

  const bodyParts = [
    `Alert: ${alertRule.name}`,
    `Query: ${alertRule.query}`,
    `Aggregate: ${alertRule.aggregate}`,
    `Time Window: ${alertRule.time_window} minutes`,
    `Threshold: ${alertRule.resolve_threshold}`,
    `Started: ${metric_alert.date_started}`,
    `Detected: ${metric_alert.date_detected}`,
    metric_alert.date_closed ? `Closed: ${metric_alert.date_closed}` : "",
  ].filter(Boolean);

  const event: PostTransformEvent = {
    deliveryId: context.deliveryId,
    sourceId: `sentry:metric-alert:${alertRule.organization_id}:${metric_alert.id}:metric-alert.${payload.action}`,
    provider: "sentry",
    eventType: `metric-alert.${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${alertRule.name}`),
    body: sanitizeBody(bodyParts.join("\n")),
    occurredAt: metric_alert.date_detected,
    entity: {
      provider: "sentry",
      entityType: "metric-alert",
      entityId: `${alertRule.organization_id}:${metric_alert.id}`,
      title: alertRule.name,
      url: null,
      state: payload.action,
    },
    relations: [],
    attributes: {
      alertId: metric_alert.id,
      alertRuleId: alertRule.id,
      alertRuleName: alertRule.name,
      organizationId: alertRule.organization_id,
      query: alertRule.query,
      aggregate: alertRule.aggregate,
      timeWindow: alertRule.time_window,
      thresholdType: alertRule.threshold_type,
      resolveThreshold: alertRule.resolve_threshold,
      dateStarted: metric_alert.date_started,
      dateDetected: metric_alert.date_detected,
      dateClosed: metric_alert.date_closed,
      action: payload.action,
      installationId: payload.installation.uuid,
    },
  };

  const validation = validatePostTransformEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryMetricAlert", event, validation.errors);
  }

  return event;
}
