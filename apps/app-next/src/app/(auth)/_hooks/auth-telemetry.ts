import { addBreadcrumb, startSpan } from "@sentry/nextjs";

interface AuthSpanAttributes {
  mode: "sign-in" | "sign-up";
  strategy?: string;
}

export function authSpan<T>(
  name: string,
  attributes: AuthSpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  return startSpan({ name, op: "auth", attributes: { ...attributes } }, fn);
}

export function authBreadcrumb(
  message: string,
  level: "info" | "warning" | "error",
  data: Record<string, unknown>
): void {
  addBreadcrumb({ category: "auth", message, level, data });
}
