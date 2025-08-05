import { env } from "~/env";

interface ApiOptions extends RequestInit {
  token?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = env.NEXT_PUBLIC_APP_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...fetchOptions.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "An unexpected error occurred",
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Session endpoints
  async createSession(agentType: "browser") {
    return this.request<{ sessionId: string; session: any }>("/api/agent/sessions", {
      method: "POST",
      body: JSON.stringify({ agentType }),
    });
  }

  async getSession(sessionId: string) {
    return this.request<{ session: any }>(`/api/agent/sessions/${sessionId}`);
  }

  async runTask(sessionId: string, task: string, url?: string) {
    return this.request<{ success: boolean; result: any }>(`/api/agent/sessions/${sessionId}/run`, {
      method: "POST",
      body: JSON.stringify({ task, url }),
    });
  }
}

export const apiClient = new ApiClient();