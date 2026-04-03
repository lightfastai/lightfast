/**
 * Minimal constants for store slug generation
 * Full validation constants are in @repo/app-validation
 */
const STORE_SLUG_MAX_LENGTH = 20; // Pinecone constraint

/**
 * Generate a Pinecone-compliant store slug
 * Sanitizes user input to meet Pinecone constraints
 */
export function generateStoreSlug(name: string): string {
  const storeSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-") // Only alphanumeric + hyphens
    .replace(/^-+/, "") // No leading hyphens
    .replace(/-+$/, "") // No trailing hyphens
    .replace(/-{2,}/g, "-"); // No consecutive hyphens

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
  if (slug.includes("--") || /^-|-$/.test(slug)) {
    return false;
  }

  return true;
}
