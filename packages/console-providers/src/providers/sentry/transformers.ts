import type { PostTransformEvent, PostTransformReference } from "../../post-transform-event.js";
import type { TransformContext } from "../../types.js";
import { validatePostTransformEvent, logValidationErrors } from "../../validation.js";
import { sanitizeTitle, sanitizeBody } from "../../sanitize.js";
import type {
  PreTransformSentryIssueWebhook,
  PreTransformSentryErrorWebhook,
  PreTransformSentryEventAlertWebhook,
  PreTransformSentryMetricAlertWebhook,
} from "./schemas.js";

export function transformSentryIssue(
  payload: PreTransformSentryIssueWebhook,
  context: TransformContext,
): PostTransformEvent {
  const { issue } = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "issue", id: issue.shortId, url: issue.permalink ?? null, label: null });
  refs.push({
    type: "project",
    id: issue.project.slug,
    url: `https://sentry.io/organizations/_/projects/${issue.project.slug}/`,
    label: null,
  });

  if (issue.assignedTo) {
    refs.push({ type: "assignee", id: issue.assignedTo.email ?? issue.assignedTo.name, url: null, label: null });
  }

  if (issue.statusDetails?.inCommit?.commit) {
    refs.push({
      type: "commit",
      id: issue.statusDetails.inCommit.commit,
      url: issue.statusDetails.inCommit.repository
        ? `https://github.com/${issue.statusDetails.inCommit.repository}/commit/${issue.statusDetails.inCommit.commit}`
        : null,
      label: "resolved_by",
    });
  }

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
    source: "sentry",
    sourceType: `issue.${payload.action}`,
    sourceId: `sentry-issue:${issue.project.slug}:${issue.shortId}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: {
      id: String(payload.actor.id),
      name: payload.actor.name,
      email: payload.actor.email ?? null,
      avatarUrl: null,
    },
    occurredAt: issue.lastSeen,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      issueId: issue.id,
      shortId: issue.shortId,
      projectId: issue.project.id,
      projectSlug: issue.project.slug,
      projectName: issue.project.name,
      level: issue.level,
      platform: issue.platform,
      errorType: issue.metadata.type,
      errorValue: issue.metadata.value,
      filename: issue.metadata.filename,
      function: issue.metadata.function,
      culprit: issue.culprit,
      count: issue.count,
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      status: issue.status,
      action: payload.action,
      installationId: payload.installation.uuid,
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
): PostTransformEvent {
  const { error: errorEvent } = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "project", id: String(errorEvent.project), url: null, label: null });

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
    source: "sentry",
    sourceType: "error",
    sourceId: `sentry-error:${errorEvent.project}:${errorEvent.event_id}`,
    title: sanitizeTitle(`[Error] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: errorEvent.user
      ? {
          id: errorEvent.user.id ?? errorEvent.user.email ?? "unknown",
          name: errorEvent.user.username ?? errorEvent.user.email ?? "Unknown User",
          email: errorEvent.user.email ?? null,
          avatarUrl: null,
        }
      : null,
    occurredAt: String(errorEvent.timestamp),
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      eventId: errorEvent.event_id,
      projectId: errorEvent.project,
      platform: errorEvent.platform,
      errorType: errorEvent.metadata.type,
      errorValue: errorEvent.metadata.value,
      filename: errorEvent.metadata.filename,
      function: errorEvent.metadata.function,
      location: errorEvent.location,
      culprit: errorEvent.culprit,
      tags: errorEvent.tags,
      sdkName: errorEvent.sdk?.name,
      sdkVersion: errorEvent.sdk?.version,
      webUrl: errorEvent.web_url,
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
): PostTransformEvent {
  const { event, triggered_rule } = payload.data;
  const refs: PostTransformReference[] = [];

  refs.push({ type: "project", id: String(event.project), url: null, label: null });

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
    source: "sentry",
    sourceType: "event-alert",
    sourceId: `sentry-alert:${event.project}:${event.event_id}:${triggered_rule.replace(/\s/g, "-")}`,
    title: sanitizeTitle(`[Alert Triggered] ${triggered_rule}: ${errorType}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: null,
    occurredAt: String(event.timestamp),
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      eventId: event.event_id,
      projectId: event.project,
      triggeredRule: triggered_rule,
      platform: event.platform,
      errorType: event.metadata.type,
      errorValue: errorValue,
      webUrl: event.web_url,
      installationId: payload.installation.uuid,
    },
  };

  const validation = validatePostTransformEvent(eventOut);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryEventAlert", eventOut, validation.errors);
  }

  return eventOut;
}

export function transformSentryMetricAlert(
  payload: PreTransformSentryMetricAlertWebhook,
  context: TransformContext,
): PostTransformEvent {
  const { metric_alert } = payload.data;
  const alertRule = metric_alert.alert_rule;
  const refs: PostTransformReference[] = [];

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
    source: "sentry",
    sourceType: "metric-alert",
    sourceId: `sentry-metric-alert:${alertRule.organization_id}:${metric_alert.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${alertRule.name}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: null,
    occurredAt: metric_alert.date_detected,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
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
