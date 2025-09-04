import { configStore } from './config.js';
import { getApiUrl, API_ENDPOINTS, DEFAULT_BASE_URL } from './config-constants.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WhoAmIResponse {
  userId: string;
  email: string;
  organizationId?: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface DeployResponse {
  deploymentId: string;
  url: string;
  status: 'pending' | 'building' | 'ready' | 'error';
}

export class LightfastClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private profileName: string;

  constructor(options: { baseUrl?: string; profileName?: string } = {}) {
    this.baseUrl = options.baseUrl || getApiUrl();
    this.profileName = options.profileName || 'default';
  }

  /**
   * Initialize the client by loading the API key from the profile
   */
  async init(): Promise<void> {
    const profile = await configStore.getProfile(this.profileName);
    if (!profile) {
      throw new Error(`Profile '${this.profileName}' not found. Run 'lightfast auth login' first.`);
    }

    this.apiKey = await configStore.getApiKey(this.profileName);
    if (!this.apiKey) {
      throw new Error(`No API key found for profile '${this.profileName}'. Run 'lightfast auth login' first.`);
    }

    // Update baseUrl from profile if available
    if (profile.endpoint) {
      this.baseUrl = profile.endpoint;
    }
  }

  /**
   * Make an authenticated HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (!this.apiKey) {
      await this.init();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'lightfast-cli',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          message: data.message || data.error || data || 'Request failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'NetworkError',
        message: error.message || 'Network request failed',
      };
    }
  }

  /**
   * Validate an API key by calling the tRPC validation endpoint
   */
  async validateApiKey(apiKey: string): Promise<ApiResponse<{ valid: boolean; userId: string; keyId: string }>> {
    const url = `${this.baseUrl}${API_ENDPOINTS.VALIDATE_API_KEY}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'lightfast-cli',
        },
        body: JSON.stringify({
          json: {
            key: apiKey
          }
        }),
      });

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          message: data?.error?.message || data?.message || data?.error || data || 'API key validation failed',
        };
      }

      // tRPC returns result in a specific format
      const result = data?.result?.data;
      if (!result) {
        return {
          success: false,
          error: 'InvalidResponse',
          message: 'Unexpected response format from API',
        };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'NetworkError',
        message: error.message || 'Network request failed',
      };
    }
  }

  /**
   * Get information about the current user using Clerk session
   * This uses the standard authentication middleware
   */
  async whoami(): Promise<ApiResponse<WhoAmIResponse>> {
    // First try the authentication endpoint with API key
    const url = `${this.baseUrl}/api/user/whoami`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'lightfast-cli',
        },
      });

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          message: data?.message || data?.error || data || 'Failed to get user information',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'NetworkError',
        message: error.message || 'Network request failed',
      };
    }
  }

  /**
   * Deploy an agent (stub implementation)
   */
  async deploy(options: {
    name: string;
    source: string;
    environment?: 'development' | 'staging' | 'production';
    config?: Record<string, any>;
  }): Promise<ApiResponse<DeployResponse>> {
    return this.request<DeployResponse>('/v1/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        source: options.source,
        environment: options.environment || 'development',
        config: options.config || {},
      }),
    });
  }

  /**
   * Get deployment status
   */
  async getDeployment(deploymentId: string): Promise<ApiResponse<DeployResponse>> {
    return this.request<DeployResponse>(`/v1/deployments/${deploymentId}`);
  }

  /**
   * List deployments
   */
  async listDeployments(options: {
    limit?: number;
    environment?: string;
  } = {}): Promise<ApiResponse<DeployResponse[]>> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.environment) params.set('environment', options.environment);

    const endpoint = `/v1/deployments${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<DeployResponse[]>(endpoint);
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.request<{ deleted: boolean }>(`/v1/deployments/${deploymentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get agent logs
   */
  async getLogs(deploymentId: string, options: {
    since?: string;
    tail?: number;
    follow?: boolean;
  } = {}): Promise<ApiResponse<{ logs: string[] }>> {
    const params = new URLSearchParams();
    if (options.since) params.set('since', options.since);
    if (options.tail) params.set('tail', options.tail.toString());
    if (options.follow) params.set('follow', options.follow.toString());

    const endpoint = `/v1/deployments/${deploymentId}/logs${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<{ logs: string[] }>(endpoint);
  }

  /**
   * Update client configuration
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set profile name
   */
  setProfile(profileName: string): void {
    this.profileName = profileName;
    this.apiKey = null; // Force reload on next request
  }

  /**
   * Get current profile name
   */
  getProfile(): string {
    return this.profileName;
  }
}

// Export a default client instance
export const lightfastClient = new LightfastClient();