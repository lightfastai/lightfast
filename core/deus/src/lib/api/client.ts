/**
 * API Client for Deus Web App
 * Handles communication with the web app's tRPC endpoints
 */

import { loadAuthConfig } from '../config/profile-config.js';

/**
 * API Key verification response
 * All API keys have admin permissions.
 */
export interface VerifyApiKeyResponse {
  userId: string;
  organizationId: string;
  scopes: string[]; // Always ['admin']
}

/**
 * Organization information from API
 */
export interface ApiOrganization {
  id: string;
  slug: string;
  name: string;
  role: string;
}

/**
 * User organizations response
 */
export interface UserOrganizationsResponse {
  organizations: ApiOrganization[];
}

/**
 * API Error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Verify API key with the web app
 */
export async function verifyApiKey(apiKey: string): Promise<VerifyApiKeyResponse> {
  const config = loadAuthConfig();
  const apiUrl = config.apiUrl;

  try {
    const response = await fetch(`${apiUrl}/api/trpc/apiKey.verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: apiKey }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as ApiErrorResponse;
      throw new Error(errorData.error?.message || 'Failed to verify API key');
    }

    const data = (await response.json()) as VerifyApiKeyResponse;
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Unable to connect to Deus API');
  }
}

/**
 * Get user's organizations
 */
export async function getUserOrganizations(apiKey: string): Promise<ApiOrganization[]> {
  const config = loadAuthConfig();
  const apiUrl = config.apiUrl;

  try {
    const response = await fetch(`${apiUrl}/api/trpc/user.organizations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as ApiErrorResponse;
      throw new Error(errorData.error?.message || 'Failed to fetch organizations');
    }

    const data = (await response.json()) as UserOrganizationsResponse;
    return data.organizations;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error: Unable to connect to Deus API');
  }
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('deus_sk_') && apiKey.length > 15;
}
