export function resolveE2EApiKey(): string {
  const value =
    process.env.LIGHTFAST_E2E_API_KEY?.trim() ??
    process.env.LIGHTFAST_SIGNAL_API_KEY?.trim();
  if (!value) {
    throw new Error(
      "Set LIGHTFAST_E2E_API_KEY=lf_... before running E2E smokes. LIGHTFAST_SIGNAL_API_KEY remains supported as a compatibility alias."
    );
  }
  if (!value.startsWith("lf_")) {
    throw new Error(
      "The E2E API key must be an Unkey public API key with the lf_ prefix."
    );
  }
  return value;
}

export function resolveE2EClerkOrgId(): string {
  const value = process.env.LIGHTFAST_E2E_CLERK_ORG_ID?.trim();
  if (!value) {
    throw new Error(
      "Set LIGHTFAST_E2E_CLERK_ORG_ID=org_... so the signal E2E can verify the persisted people side effect."
    );
  }
  return value;
}

export function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

export function shouldCheckAppHealth(): boolean {
  return process.env.LIGHTFAST_E2E_SKIP_APP_HEALTH !== "1";
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeUrl(value: string, name: string): string {
  const trimmed = trimTrailingSlash(value.trim());
  try {
    new URL(trimmed);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  return trimmed;
}

export function allowLocalhostTls(url: string): void {
  const parsed = new URL(url);
  if (
    parsed.protocol === "https:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost")) &&
    process.env.LIGHTFAST_E2E_STRICT_TLS !== "1"
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}
