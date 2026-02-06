/**
 * Sentry Transformer for Production Webhooks
 *
 * Transforms official Sentry webhook payloads to SourceEvent.
 * Based on Sentry's webhook documentation and actual payload structures.
 *
 * @see https://docs.sentry.io/product/integrations/integration-platform/webhooks/
 */

import type {
  SourceEvent,
  SourceReference,
  TransformContext,
} from "@repo/console-types";
import { validateSourceEvent } from "../validation.js";
import { sanitizeTitle, sanitizeBody } from "../sanitize.js";

// ============================================================================
// Official Sentry Webhook Payload Types
// Based on Sentry Integration Platform webhook documentation
// ============================================================================

/**
 * Sentry Issue Alert Webhook Payload
 * Sent when issue alerts are triggered (issue state changes)
 */
export interface SentryIssueWebhook {
  action: "created" | "resolved" | "assigned" | "ignored";
  data: {
    issue: SentryIssue;
  };
  installation: {
    uuid: string;
  };
  actor: SentryActor;
}

/**
 * Sentry Error Event Webhook Payload
 * Sent for individual error events (when configured)
 */
export interface SentryErrorWebhook {
  action: "created";
  data: {
    event: SentryErrorEvent;
  };
  installation: {
    uuid: string;
  };
}

/**
 * Sentry Event Alert Webhook Payload
 * Sent when alert rules fire
 */
export interface SentryEventAlertWebhook {
  action: "triggered";
  data: {
    event: SentryErrorEvent;
    triggered_rule: string;
  };
  installation: {
    uuid: string;
  };
}

/**
 * Sentry Metric Alert Webhook Payload
 * Sent when metric-based alerts fire
 */
export interface SentryMetricAlertWebhook {
  action: "triggered" | "resolved";
  data: {
    metric_alert: {
      id: string;
      alert_rule: {
        id: number;
        name: string;
        organization_id: string;
        status: number;
        query: string;
        threshold_type: number;
        resolve_threshold: number;
        time_window: number;
        aggregate: string;
      };
      date_started: string;
      date_detected: string;
      date_closed: string | null;
    };
  };
  installation: {
    uuid: string;
  };
}

/**
 * Sentry Issue (grouped errors)
 * Documentation: https://docs.sentry.io/api/issues/
 */
export interface SentryIssue {
  id: string;
  shortId: string; // e.g., "LIGHTFAST-123"
  title: string;
  culprit: string; // File/function where error originated
  status: "unresolved" | "resolved" | "ignored";
  level: "fatal" | "error" | "warning" | "info" | "debug";
  platform: string;
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  count: number; // Total event count
  userCount: number;
  permalink: string;
  metadata: {
    type: string; // Error type (e.g., "TypeError", "ReferenceError")
    value: string; // Error message
    filename?: string; // Source file
    function?: string; // Function name
  };
  project: {
    id: string;
    name: string;
    slug: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  /** Resolution status details - populated when issue is resolved */
  statusDetails?: {
    /** Commit that resolved this issue */
    inCommit?: {
      repository?: string;
      commit?: string;
    };
    /** Release version that resolved this issue */
    inRelease?: string;
    /** Whether resolved in next release */
    inNextRelease?: boolean;
  };
  logger?: string;
  type: "error" | "default";
  annotations: string[];
  isPublic: boolean;
  isBookmarked: boolean;
  isSubscribed: boolean;
  hasSeen: boolean;
  numComments: number;
}

/**
 * Sentry Error Event (individual error occurrence)
 */
export interface SentryErrorEvent {
  event_id: string;
  project: number;
  timestamp: string;
  received: string;
  platform: string;
  message?: string;
  title: string;
  location?: string;
  culprit?: string;
  type: "error" | "default";
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  tags: Array<{ key: string; value: string }>;
  contexts?: Record<string, Record<string, unknown>>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
    ip_address?: string;
  };
  sdk?: {
    name: string;
    version: string;
  };
  context?: Record<string, unknown>;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
          colno?: number;
          context_line?: string;
          pre_context?: string[];
          post_context?: string[];
        }>;
      };
    }>;
  };
  web_url?: string;
  issue_url?: string;
}

/**
 * Sentry Actor (who performed the action)
 */
export interface SentryActor {
  type: "user" | "application";
  id: string;
  name: string;
  email?: string;
}

// ============================================================================
// Sentry Event Type Enum
// ============================================================================

export type SentryEventType =
  | "issue.created"
  | "issue.resolved"
  | "issue.assigned"
  | "issue.ignored"
  | "error"
  | "event_alert"
  | "metric_alert";

// ============================================================================
// Log validation errors helper
// ============================================================================

function logValidationErrors(
  transformerName: string,
  event: SourceEvent,
  errors: string[]
): void {
  console.error(`[Transformer:${transformerName}] Invalid SourceEvent:`, {
    sourceId: event.sourceId,
    sourceType: event.sourceType,
    errors,
  });
}

// ============================================================================
// Transformer Functions
// ============================================================================

/**
 * Transform Sentry issue webhook to SourceEvent
 */
export function transformSentryIssue(
  payload: SentryIssueWebhook,
  context: TransformContext
): SourceEvent {
  const { issue } = payload.data;
  const refs: SourceReference[] = [];

  // Add issue reference
  refs.push({
    type: "issue",
    id: issue.shortId,
    url: issue.permalink,
  });

  // Add project reference
  refs.push({
    type: "project",
    id: issue.project.slug,
    url: `https://sentry.io/organizations/_/projects/${issue.project.slug}/`,
  });

  // Add assignee if present
  if (issue.assignedTo) {
    refs.push({
      type: "assignee",
      id: issue.assignedTo.email || issue.assignedTo.name,
    });
  }

  // Extract commit from resolution (if resolved via commit)
  if (issue.statusDetails?.inCommit?.commit) {
    refs.push({
      type: "commit",
      id: issue.statusDetails.inCommit.commit,
      url: issue.statusDetails.inCommit.repository
        ? `https://github.com/${issue.statusDetails.inCommit.repository}/commit/${issue.statusDetails.inCommit.commit}`
        : undefined,
      label: "resolved_by",
    });
  }

  const actionTitles: Record<string, string> = {
    created: "Issue Created",
    resolved: "Issue Resolved",
    assigned: "Issue Assigned",
    ignored: "Issue Ignored",
  };

  const errorType = issue.metadata.type || "Error";
  const errorValue = issue.metadata.value || issue.title;
  const location = issue.metadata.filename
    ? `in ${issue.metadata.filename}`
    : issue.culprit
      ? `in ${issue.culprit}`
      : "";

  // Semantic body for embedding
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

  const event: SourceEvent = {
    source: "sentry",
    sourceType: `issue.${payload.action}`,
    sourceId: `sentry-issue:${issue.project.slug}:${issue.shortId}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitles[payload.action]}] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: {
      id: payload.actor.id,
      name: payload.actor.name,
      email: payload.actor.email,
    },
    occurredAt: issue.lastSeen,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      issueId: issue.id,
      shortId: issue.shortId,
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

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryIssue", event, validation.errors);
  }

  return event;
}

/**
 * Transform Sentry error event webhook to SourceEvent
 */
export function transformSentryError(
  payload: SentryErrorWebhook,
  context: TransformContext
): SourceEvent {
  const { event } = payload.data;
  const refs: SourceReference[] = [];

  // Add project reference
  refs.push({
    type: "project",
    id: String(event.project),
  });

  // Extract stack trace info for body
  const stackInfo =
    event.exception?.values
      ?.map((exc) => {
        const topFrame = exc.stacktrace?.frames?.slice(-1)[0];
        return topFrame
          ? `${exc.type} at ${topFrame.filename}:${topFrame.lineno} in ${topFrame.function}`
          : `${exc.type}: ${exc.value}`;
      })
      .join("\n") || "";

  const errorType = event.metadata?.type || "Error";
  const errorValue = event.metadata?.value || event.title;

  const bodyParts = [
    event.title,
    event.message,
    event.metadata?.value,
    event.location ? `Location: ${event.location}` : "",
    stackInfo,
    `Platform: ${event.platform}`,
  ].filter(Boolean);

  const event_out: SourceEvent = {
    source: "sentry",
    sourceType: "error",
    sourceId: `sentry-error:${event.project}:${event.event_id}`,
    title: sanitizeTitle(`[Error] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: event.user
      ? {
          id: event.user.id || event.user.email || "unknown",
          name: event.user.username || event.user.email || "Unknown User",
          email: event.user.email,
        }
      : undefined,
    occurredAt: event.timestamp,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      eventId: event.event_id,
      projectId: event.project,
      platform: event.platform,
      errorType: event.metadata?.type,
      errorValue: event.metadata?.value,
      filename: event.metadata?.filename,
      function: event.metadata?.function,
      location: event.location,
      culprit: event.culprit,
      tags: event.tags,
      sdkName: event.sdk?.name,
      sdkVersion: event.sdk?.version,
      webUrl: event.web_url,
      installationId: payload.installation.uuid,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event_out);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryError", event_out, validation.errors);
  }

  return event_out;
}

/**
 * Transform Sentry event alert webhook to SourceEvent
 */
export function transformSentryEventAlert(
  payload: SentryEventAlertWebhook,
  context: TransformContext
): SourceEvent {
  const { event, triggered_rule } = payload.data;
  const refs: SourceReference[] = [];

  refs.push({
    type: "project",
    id: String(event.project),
  });

  const errorType = event.metadata?.type || "Alert";
  const errorValue = event.metadata?.value || event.title;

  const bodyParts = [
    `Alert Rule: ${triggered_rule}`,
    event.title,
    event.message,
    event.metadata?.value,
    `Platform: ${event.platform}`,
  ].filter(Boolean);

  const event_out: SourceEvent = {
    source: "sentry",
    sourceType: "event_alert",
    sourceId: `sentry-alert:${event.project}:${event.event_id}:${triggered_rule.replace(/\s/g, "-")}`,
    title: sanitizeTitle(`[Alert Triggered] ${triggered_rule}: ${errorType}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: undefined,
    occurredAt: event.timestamp,
    references: refs,
    metadata: {
      deliveryId: context.deliveryId,
      eventId: event.event_id,
      projectId: event.project,
      triggeredRule: triggered_rule,
      platform: event.platform,
      errorType: event.metadata?.type,
      errorValue: event.metadata?.value,
      webUrl: event.web_url,
      installationId: payload.installation.uuid,
    },
  };

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event_out);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryEventAlert", event_out, validation.errors);
  }

  return event_out;
}

/**
 * Transform Sentry metric alert webhook to SourceEvent
 */
export function transformSentryMetricAlert(
  payload: SentryMetricAlertWebhook,
  context: TransformContext
): SourceEvent {
  const { metric_alert } = payload.data;
  const alertRule = metric_alert.alert_rule;
  const refs: SourceReference[] = [];

  const actionTitle =
    payload.action === "triggered" ? "Metric Alert Triggered" : "Metric Alert Resolved";

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

  const event: SourceEvent = {
    source: "sentry",
    sourceType: "metric_alert",
    sourceId: `sentry-metric-alert:${alertRule.organization_id}:${metric_alert.id}:${payload.action}`,
    title: sanitizeTitle(`[${actionTitle}] ${alertRule.name}`),
    body: sanitizeBody(bodyParts.join("\n")),
    actor: undefined,
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

  // Validate before returning (logs errors but doesn't block)
  const validation = validateSourceEvent(event);
  if (!validation.success && validation.errors) {
    logValidationErrors("transformSentryMetricAlert", event, validation.errors);
  }

  return event;
}

// ============================================================================
// Exported Transformer Map
// ============================================================================

export const sentryTransformers = {
  "issue.created": (payload: unknown, ctx: TransformContext) =>
    transformSentryIssue(payload as SentryIssueWebhook, ctx),
  "issue.resolved": (payload: unknown, ctx: TransformContext) =>
    transformSentryIssue(payload as SentryIssueWebhook, ctx),
  "issue.assigned": (payload: unknown, ctx: TransformContext) =>
    transformSentryIssue(payload as SentryIssueWebhook, ctx),
  "issue.ignored": (payload: unknown, ctx: TransformContext) =>
    transformSentryIssue(payload as SentryIssueWebhook, ctx),
  error: (payload: unknown, ctx: TransformContext) =>
    transformSentryError(payload as SentryErrorWebhook, ctx),
  event_alert: (payload: unknown, ctx: TransformContext) =>
    transformSentryEventAlert(payload as SentryEventAlertWebhook, ctx),
  metric_alert: (payload: unknown, ctx: TransformContext) =>
    transformSentryMetricAlert(payload as SentryMetricAlertWebhook, ctx),
};
