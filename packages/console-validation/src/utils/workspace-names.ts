import { friendlyWords } from "friendlier-words";
import { WORKSPACE_NAME, STORE_NAME } from "../constants/naming";

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
 * Generate internal slug from workspace name
 *
 * Converts to lowercase and sanitizes to alphanumeric + hyphens only.
 * Used for Pinecone index naming: ws-{slug}-{store}
 *
 * Examples:
 * - "Robust Chicken" → "robust-chicken"
 * - "My-Awesome-Workspace" → "my-awesome-workspace"
 * - "api.v2" → "api-v2"
 * - "my_project" → "my-project"
 *
 * Throws if resulting slug exceeds length limit (20 chars for Pinecone).
 */
export function generateWorkspaceSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") // Convert everything except alphanumeric and hyphens to hyphens
    .replace(/^-+/, "")            // No leading hyphens
    .replace(/-+$/, "")            // No trailing hyphens
    .replace(/-{2,}/g, "-");       // No consecutive hyphens

  if (slug.length === 0) {
    throw new Error("Workspace slug cannot be empty after sanitization");
  }

  // Truncate to 20 chars for Pinecone constraint: ws-{20}-{20} = 44 chars total
  const truncated = slug.substring(0, 20);

  return truncated;
}

/**
 * Validate internal workspace slug meets Pinecone constraints
 * Note: This is for internal validation only. User-facing names are validated separately.
 */
export function validateWorkspaceSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > 20) {
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

  if (storeSlug.length > STORE_NAME.MAX_LENGTH) {
    throw new Error(
      `Store slug too long (${storeSlug.length} chars). Max: ${STORE_NAME.MAX_LENGTH}`
    );
  }

  return storeSlug;
}

/**
 * Validate a store slug meets Pinecone constraints
 */
export function validateStoreSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > STORE_NAME.MAX_LENGTH) {
    return false;
  }

  // Must be lowercase alphanumeric + hyphens only
  if (!STORE_NAME.PATTERN.test(slug)) {
    return false;
  }

  // No leading/trailing/consecutive hyphens
  if (STORE_NAME.NO_CONSECUTIVE_HYPHENS.test(slug) || /^-|-$/.test(slug)) {
    return false;
  }

  return true;
}
