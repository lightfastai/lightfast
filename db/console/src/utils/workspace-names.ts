import { friendlyWords } from "friendlier-words";

/**
 * Minimal constants for workspace/store slug generation
 * Full validation constants are in @repo/console-validation
 */
const WORKSPACE_SLUG_MAX_LENGTH = 20; // Pinecone constraint
const STORE_SLUG_MAX_LENGTH = 20;     // Pinecone constraint

/**
 * Generate a friendly workspace name
 *
 * Examples:
 * - "Robust Chicken"
 * - "Happy Cat"
 * - "Modest Pear"
 */
export function generateWorkspaceName(): string {
  const words = friendlyWords();
  // Capitalize first letter of each word
  return words
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generate a random workspace slug
 *
 * Creates a random adjective-animal combination in lowercase with hyphen.
 * Used for internal Pinecone index naming when user provides their own workspace name.
 *
 * Examples:
 * - "robust-chicken"
 * - "happy-cat"
 * - "modest-pear"
 */
export function generateRandomSlug(): string {
  // friendlyWords() returns format like "robust-chicken"
  const slug = friendlyWords();

  // Ensure it meets constraints (should already be valid, but verify)
  if (slug.length > WORKSPACE_SLUG_MAX_LENGTH) {
    // Truncate if needed
    return slug.substring(0, WORKSPACE_SLUG_MAX_LENGTH);
  }

  return slug;
}

/**
 * Validate internal workspace slug meets Pinecone constraints
 * Note: This is for internal validation only. User-facing names are validated separately.
 */
export function validateWorkspaceSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > WORKSPACE_SLUG_MAX_LENGTH) {
    return false;
  }

  // Must be lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return false;
  }

  // No leading/trailing/consecutive hyphens
  if (/--/.test(slug) || /^-|-$/.test(slug)) {
    return false;
  }

  return true;
}

/**
 * Generate a Pinecone-compliant store slug
 * Sanitizes user input to meet Pinecone constraints
 */
export function generateStoreSlug(name: string): string {
  const storeSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") // Only alphanumeric + hyphens
    .replace(/^-+/, "")            // No leading hyphens
    .replace(/-+$/, "")            // No trailing hyphens
    .replace(/-{2,}/g, "-");       // No consecutive hyphens

  if (storeSlug.length === 0) {
    throw new Error("Store slug cannot be empty after sanitization");
  }

  if (storeSlug.length > STORE_SLUG_MAX_LENGTH) {
    throw new Error(
      `Store slug too long (${storeSlug.length} chars). Max: ${STORE_SLUG_MAX_LENGTH}`
    );
  }

  return storeSlug;
}

/**
 * Validate a store slug meets Pinecone constraints
 */
export function validateStoreSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > STORE_SLUG_MAX_LENGTH) {
    return false;
  }

  // Must be lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return false;
  }

  // No leading/trailing/consecutive hyphens
  if (/--/.test(slug) || /^-|-$/.test(slug)) {
    return false;
  }

  return true;
}
