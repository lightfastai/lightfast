import { friendlyWords } from "friendlier-words";

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
 * Pinecone index naming constraints:
 * - Max 45 characters (we reserve space for "ws-" prefix and store suffix)
 * - Only lowercase alphanumeric and hyphens
 * - No leading/trailing hyphens
 * - No consecutive hyphens
 */
const MAX_SLUG_LENGTH = 20; // Leave room for "ws-" prefix (3) + "-store-name" (20) = 44 chars total

/**
 * Generate a Pinecone-compliant slug from a workspace name
 *
 * Examples:
 * - "Robust Chicken" → "robust-chicken"
 * - "Happy Cat!" → "happy-cat"
 * - "My @ Workspace" → "my-workspace"
 *
 * Throws if resulting slug exceeds length limit.
 */
export function generateWorkspaceSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") // Only alphanumeric + hyphens
    .replace(/^-+/, "")            // No leading hyphens
    .replace(/-+$/, "")            // No trailing hyphens
    .replace(/-{2,}/g, "-");       // No consecutive hyphens

  if (slug.length === 0) {
    throw new Error("Workspace slug cannot be empty after sanitization");
  }

  if (slug.length > MAX_SLUG_LENGTH) {
    throw new Error(
      `Workspace slug too long (${slug.length} chars). Max: ${MAX_SLUG_LENGTH}`
    );
  }

  return slug;
}

/**
 * Validate a workspace slug meets Pinecone constraints
 * Used for custom slugs provided by users (Phase 2)
 */
export function validateWorkspaceSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  // Must be lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return false;
  }

  // No leading/trailing/consecutive hyphens
  if (/^-|-$|--/.test(slug)) {
    return false;
  }

  return true;
}

/**
 * Store slug constraints (for Pinecone index naming)
 * - Max 20 characters (balanced with workspace key)
 * - Only lowercase alphanumeric and hyphens
 * - No leading/trailing hyphens
 * - No consecutive hyphens
 */
const MAX_STORE_SLUG_LENGTH = 20;

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

  if (storeSlug.length > MAX_STORE_SLUG_LENGTH) {
    throw new Error(
      `Store slug too long (${storeSlug.length} chars). Max: ${MAX_STORE_SLUG_LENGTH}`
    );
  }

  return storeSlug;
}

/**
 * Validate a store slug meets Pinecone constraints
 */
export function validateStoreSlug(slug: string): boolean {
  if (slug.length === 0 || slug.length > MAX_STORE_SLUG_LENGTH) {
    return false;
  }

  // Must be lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return false;
  }

  // No leading/trailing/consecutive hyphens
  if (/^-|-$|--/.test(slug)) {
    return false;
  }

  return true;
}
