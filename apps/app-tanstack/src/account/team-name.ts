export function normalizeTeamSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "");
}

export function createTeamIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `org-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
