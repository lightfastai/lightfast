// ── Provider Names ──

export const PROVIDER_NAMES = ["github", "vercel", "linear", "sentry"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

// ── Installation Statuses ──

export const INSTALLATION_STATUSES = [
  "pending",
  "active",
  "error",
  "revoked",
] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

// ── Resource Statuses ──

export const RESOURCE_STATUSES = ["active", "removed"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

// ── Delivery Statuses ──

export const DELIVERY_STATUSES = ["delivered", "dlq", "duplicate"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
