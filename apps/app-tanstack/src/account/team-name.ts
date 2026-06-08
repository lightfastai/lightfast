export function normalizeTeamSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+/, "");
}

export function createTeamIdempotencyKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    return `org-${token}`;
  }

  throw new Error("Secure random values are unavailable.");
}
