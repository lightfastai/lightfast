import type {
  CreateSignalInput,
  CreateSignalOutput,
  GetSignalInput,
  GetSignalOutput,
  SystemHealthOutput,
} from "@repo/api-contract";

declare const __SDK_VERSION__: string;

export interface LightfastOptions {
  /** API base URL. Defaults to `https://lightfast.ai`. */
  baseUrl?: string;
  /** Custom fetch implementation (for testing or proxying). */
  fetch?: typeof fetch;
}

export interface LightfastClient {
  signals: {
    create(input: CreateSignalInput): Promise<CreateSignalOutput>;
    get(input: GetSignalInput): Promise<GetSignalOutput>;
  };
  system: {
    health(): Promise<SystemHealthOutput>;
  };
}

export class LightfastApiError extends Error {
  readonly body: unknown;
  readonly status: number;

  constructor(input: { body: unknown; status: number; statusText: string }) {
    super(`Lightfast API request failed: ${input.status} ${input.statusText}`);
    this.name = "LightfastApiError";
    this.body = input.body;
    this.status = input.status;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/api/v1${path}`;
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestJson<TOutput>(input: {
  apiKey: string;
  body?: unknown;
  fetch: typeof fetch;
  method: "GET" | "POST";
  url: string;
}): Promise<TOutput> {
  const headers = new Headers({
    authorization: `Bearer ${input.apiKey}`,
  });
  const init: RequestInit = {
    headers,
    method: input.method,
  };

  if (input.body !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(input.body);
  }

  const response = await input.fetch(new Request(input.url, init));
  const body = await responseBody(response);
  if (!response.ok) {
    throw new LightfastApiError({
      body,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return body as TOutput;
}

export function createLightfast(
  apiKey: string,
  options: LightfastOptions = {}
): LightfastClient {
  if (!apiKey?.startsWith("lf_") || apiKey.length <= "lf_".length) {
    throw new Error("Invalid Lightfast API key");
  }

  const baseUrl = options.baseUrl ?? "https://lightfast.ai";
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const fetchImpl = options.fetch ?? fetch;

  return {
    signals: {
      create(input) {
        return requestJson({
          apiKey,
          body: input,
          fetch: fetchImpl,
          method: "POST",
          url: apiUrl(normalizedBase, "/signals"),
        });
      },
      get(input) {
        return requestJson({
          apiKey,
          fetch: fetchImpl,
          method: "GET",
          url: apiUrl(
            normalizedBase,
            `/signals/${encodeURIComponent(input.id)}`
          ),
        });
      },
    },
    system: {
      health() {
        return requestJson({
          apiKey,
          fetch: fetchImpl,
          method: "GET",
          url: apiUrl(normalizedBase, "/system/health"),
        });
      },
    },
  };
}

export const VERSION: string = __SDK_VERSION__;
