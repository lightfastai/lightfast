import { configStore } from './config.js';

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
    this.baseUrl = options.baseUrl || 'https://api.lightfast.ai';
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
   * Validate an API key by making a test request
   */
  async validateApiKey(apiKey: string): Promise<ApiResponse<WhoAmIResponse>> {
    const tempClient = new LightfastClient({ 
      baseUrl: this.baseUrl,
      profileName: this.profileName 
    });
    tempClient.apiKey = apiKey;

    return tempClient.whoami();
  }

  /**
   * Get information about the current user
   */
  async whoami(): Promise<ApiResponse<WhoAmIResponse>> {
    return this.request<WhoAmIResponse>('/v1/auth/whoami');
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