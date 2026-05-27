import { trimTrailingSlash } from "./env";

export class E2EHttpError extends Error {
  constructor(
    message: string,
    readonly details: {
      body: string;
      method: string;
      status: number;
      url: string;
    }
  ) {
    super(message);
    this.name = "E2EHttpError";
  }
}

export async function fetchJson(
  baseUrl: string,
  path: `/${string}`,
  init: RequestInit,
  expectedStatus: number
): Promise<unknown> {
  const url = `${trimTrailingSlash(baseUrl)}${path}`;
  const method = init.method ?? "GET";
  const response = await fetch(url, init);
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new E2EHttpError(
      `${method} ${path} returned HTTP ${response.status}, expected ${expectedStatus}.`,
      {
        body: text.slice(0, 2000),
        method,
        status: response.status,
        url,
      }
    );
  }

  return text ? JSON.parse(text) : null;
}
