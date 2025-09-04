import { configStore } from './config.js';
import { getApiUrl, API_ENDPOINTS, DEFAULT_BASE_URL } from './config-constants.js';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidateKeyResponse {
  valid: boolean;
  userId: string;
  keyId: string;
}

export interface WhoAmIResponse {
  userId: string;
  keyId: string;
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
  async validateApiKey(apiKey: string): Promise<ApiResponse<ValidateKeyResponse>> {
    // Use tRPC endpoint with proper format
    const url = `${this.baseUrl}/api/trpc/apiKey.validate`;
    
    // tRPC expects input wrapped in specific format for mutations
    const requestBody = {
      json: {
        key: apiKey
      }
    };
    
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'lightfast-cli',
        },
        body: JSON.stringify(requestBody),
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

      // tRPC returns result in a specific format for non-batched requests
      // The response has an extra 'json' wrapper that needs to be handled
      const result = data?.result?.data?.json || data?.result?.data;
      
      if (!result || !result.valid) {
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
   * Get information about the current user using API key
   * Uses tRPC endpoint for consistency
   */
  async whoami(): Promise<ApiResponse<WhoAmIResponse>> {
    if (!this.apiKey) {
      await this.init();
    }

    // Use tRPC endpoint with proper format
    const url = `${this.baseUrl}/api/trpc/apiKey.whoami`;
    
    // tRPC expects input wrapped in specific format for mutations
    const requestBody = {
      json: {
        key: this.apiKey
      }
    };
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'lightfast-cli',
        },
        body: JSON.stringify(requestBody),
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
          message: data?.error?.message || data?.message || data?.error || data || 'Failed to get user information',
        };
      }

      // tRPC returns result in a specific format for non-batched requests
      // The response has an extra 'json' wrapper that needs to be handled
      const result = data?.result?.data?.json || data?.result?.data;
      
      if (!result) {
        return {
          success: false,
          error: 'InvalidResponse',
          message: 'Unexpected response format from API',
        };
      }

      // Return the simplified response
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