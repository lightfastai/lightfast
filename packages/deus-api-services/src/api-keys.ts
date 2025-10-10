import { DeusApiService } from "./base-service";

export class ApiKeysService extends DeusApiService {
  /**
   * Generate a new API key for CLI authentication
   *
   * Security notes:
   * - The actual key is returned ONCE and never again
   * - Only the hashed key is stored in the database
   * - Save the returned key immediately as it cannot be retrieved later
   * - All API keys have admin permissions
   *
   * @param organizationId - The organization ID to generate the key for
   * @param name - A descriptive name for the API key
   * @returns Object containing the key, preview, and ID
   */
  async generateApiKey(
    organizationId: string,
    name: string,
  ) {
    return await this.call(
      "apiKey.generate",
      (caller) =>
        caller.apiKey.generate({
          organizationId,
          name,
        }),
      {
        fallbackMessage: "Failed to generate API key",
        details: { organizationId, name },
      },
    );
  }

  /**
   * List all API keys for an organization
   *
   * Returns metadata only - never returns the actual key or hash.
   *
   * @param organizationId - The organization ID to list keys for
   * @returns Array of API key metadata
   */
  async listApiKeys(organizationId: string) {
    return await this.call(
      "apiKey.list",
      (caller) => caller.apiKey.list({ organizationId }),
      {
        fallbackMessage: "Failed to list API keys",
        details: { organizationId },
      },
    );
  }

  /**
   * Revoke an API key
   *
   * Performs a soft delete by setting the revokedAt timestamp.
   * Keys are never hard deleted for audit purposes.
   *
   * @param id - The API key ID to revoke
   * @returns Success indicator
   */
  async revokeApiKey(id: string) {
    return await this.call(
      "apiKey.revoke",
      (caller) => caller.apiKey.revoke({ id }),
      {
        fallbackMessage: "Failed to revoke API key",
        details: { id },
      },
    );
  }
}
