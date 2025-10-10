/**
 * Simple tRPC HTTP Client
 * Handles tRPC request/response format automatically
 */

import { getApiUrl } from '../config/config.js';

/**
 * tRPC Error Response
 */
export interface TRPCErrorResponse {
  error: {
    code: string;
    message: string;
    data?: {
      zodError?: unknown;
    };
  };
}

/**
 * Make a tRPC mutation request
 */
export async function trpcMutation<TInput, TOutput>(
  procedure: string,  // e.g., "session.create"
  input: TInput,
  apiKey: string
): Promise<TOutput> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/api/trpc/${procedure}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ json: input }),  // tRPC mutation format
  });

  if (!response.ok) {
    const errorData = (await response.json()) as TRPCErrorResponse;
    throw new Error(
      errorData.error?.message || `tRPC mutation failed: ${response.status}`
    );
  }

  // tRPC mutations return: { result: { data: {...} } }
  const responseData = (await response.json()) as { result: { data: TOutput } };
  return responseData.result.data;
}

/**
 * Make a tRPC query request
 */
export async function trpcQuery<TInput, TOutput>(
  procedure: string,  // e.g., "user.organizations"
  input: TInput | undefined,
  apiKey: string
): Promise<TOutput> {
  const apiUrl = getApiUrl();

  // tRPC queries use GET with input as query param
  const searchParams = new URLSearchParams();
  if (input !== undefined) {
    searchParams.set('input', JSON.stringify({ json: input }));
  }

  const url = `${apiUrl}/api/trpc/${procedure}${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = (await response.json()) as TRPCErrorResponse;
    throw new Error(
      errorData.error?.message || `tRPC query failed: ${response.status}`
    );
  }

  // tRPC queries return: { result: { data: { json: [...] } } }
  const responseData = (await response.json()) as { result: { data: { json: TOutput } } };
  return responseData.result.data.json;
}
