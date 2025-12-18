/**
 * Re-export Basehub scalar types for consumers.
 *
 * This file ensures the module augmentation in basehub-types.d.ts is loaded
 * and provides a clean API for accessing project-specific Basehub types.
 *
 * Consumers should import from "@vendor/cms/types" instead of "basehub" directly.
 */

// Import the type augmentation file to ensure it's loaded
import "./basehub-types.d.ts";

// Re-export the augmented Scalars type
export type { Scalars } from "basehub";

// Re-export specific scalar types for convenience
export type { Scalars as BasehubScalars } from "basehub";

// Type aliases for commonly used BSHBSelect types
import type { Scalars } from "basehub";

export type ContentType = Scalars["BSHBSelect__442379851"];
export type BusinessGoal = Scalars["BSHBSelect__1319627841"];
export type CTAType = Scalars["BSHBSelect_957971831"];
export type PostStatus = Scalars["BSHBSelect_950708073"];
