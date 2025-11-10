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
 * Generate a slug from a workspace name
 *
 * Examples:
 * - "Robust Chicken" → "robust-chicken"
 * - "Happy Cat" → "happy-cat"
 */
export function generateWorkspaceSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}
