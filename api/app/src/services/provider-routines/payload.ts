import type { ProviderRoutineCallPayload } from "@db/app";

type JsonValue =
  | JsonValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: JsonValue };

export const REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE = "[redacted]";

const SENSITIVE_KEY_MARKERS = [
  "accesstoken",
  "apikey",
  "authorization",
  "bearer",
  "clientsecret",
  "cookie",
  "password",
  "privatekey",
  "refreshtoken",
  "secret",
  "token",
] as const;

const SENSITIVE_VALUE_PATTERN =
  /(?:^|[\s"'`:=&?/_-])(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|token)(?:$|[\s"'`:=&?/_-])/i;

export function captureProviderRoutinePayload(
  value: unknown
): ProviderRoutineCallPayload {
  if (value === undefined) {
    return null;
  }

  return sanitizeProviderRoutinePayload(value);
}

export function sanitizeProviderRoutinePayload(
  value: unknown
): ProviderRoutineCallPayload {
  const serialized = toJsonValue(value, new WeakSet<object>());
  if (
    serialized !== null &&
    typeof serialized === "object" &&
    !Array.isArray(serialized)
  ) {
    return serialized;
  }

  return { value: serialized };
}

function toJsonValue(
  value: unknown,
  stack: WeakSet<object>,
  key?: string
): JsonValue {
  if (key && isSensitiveKey(key)) {
    return REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE;
  }

  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "boolean":
      return value;
    case "string":
      return isSensitiveString(value)
        ? REDACTED_PROVIDER_ROUTINE_PAYLOAD_VALUE
        : value;
    case "bigint":
      return value.toString();
    case "number":
      return Number.isFinite(value) ? value : null;
    case "undefined":
    case "function":
    case "symbol":
      return null;
    case "object":
      break;
    default:
      return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (stack.has(value)) {
    return "[Circular]";
  }
  stack.add(value);

  if (Array.isArray(value)) {
    const items = value.map((item) => toJsonValue(item, stack));
    stack.delete(value);
    return items;
  }

  const object = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      toJsonValue(child, stack, key),
    ])
  );
  stack.delete(value);
  return object;
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_MARKERS.some((marker) => normalized.includes(marker));
}

function isSensitiveString(value: string): boolean {
  return SENSITIVE_VALUE_PATTERN.test(value);
}
