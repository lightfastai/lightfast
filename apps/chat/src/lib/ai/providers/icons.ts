import type { IconProvider } from "./schemas";
import { IconProviderSchema, ICON_PROVIDER_DISPLAY_NAMES } from "./schemas";

// Derive the provider icons from the schema to avoid duplication
export const PROVIDER_ICONS: Record<IconProvider, string> = IconProviderSchema.options.reduce(
  (acc, provider) => {
    acc[provider] = provider; // Icon name matches provider name
    return acc;
  },
  {} as Record<IconProvider, string>,
);

// Re-export display names from schema
export const PROVIDER_DISPLAY_NAMES = ICON_PROVIDER_DISPLAY_NAMES;

/**
 * Get provider icon by icon provider ID
 */
export function getProviderIcon(provider: IconProvider): string {
  return PROVIDER_ICONS[provider];
}

/**
 * Get provider display name by icon provider ID
 */
export function getProviderDisplayName(provider: IconProvider): string {
  return PROVIDER_DISPLAY_NAMES[provider];
}