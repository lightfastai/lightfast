/**
 * Database environment variables for chat
 *
 * Re-exports from @vendor/db/env to ensure single source of truth for validation.
 * The vendor package provides PlanetScale credential format validation:
 * - DATABASE_HOST must NOT start with credential prefixes (pscale_pw_, pscale_api_)
 * - DATABASE_USERNAME must start with pscale_api_
 * - DATABASE_PASSWORD must start with pscale_pw_
 */
export { env } from "@vendor/db/env";
