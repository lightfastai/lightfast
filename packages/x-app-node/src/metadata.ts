import { z } from "zod";

import { assertXEndpointAllowed, DEFAULT_X_ENDPOINTS } from "./config";
import { XAppNodeError } from "./errors";

const DEFAULT_X_METADATA_TIMEOUT_MS = 10_000;

const xViewerResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    username: z.string().min(1),
  }),
});

export interface XConnectorMetadata {
  actorId: string;
  actorName: string;
  name: string;
  username: string;
}

export async function getXViewerMetadata(input: {
  accessToken: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  viewerUrl?: string;
}): Promise<XConnectorMetadata> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_X_METADATA_TIMEOUT_MS
        );

  try {
    const viewerUrl = input.viewerUrl ?? DEFAULT_X_ENDPOINTS.viewerUrl;
    assertXEndpointAllowed({
      defaultValue: DEFAULT_X_ENDPOINTS.viewerUrl,
      nodeEnv: input.nodeEnv,
      value: viewerUrl,
    });

    const response = await requestFetch(viewerUrl, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.accessToken}`,
      },
      method: "GET",
      signal,
    });
    const json = await response.json().catch(() => null);
    const parsed = xViewerResponseSchema.safeParse(json);

    if (!(response.ok && parsed.success)) {
      throw new XAppNodeError(
        "X_METADATA_FAILED",
        "X metadata request failed."
      );
    }

    return {
      actorId: parsed.data.data.id,
      actorName: `@${parsed.data.data.username}`,
      name: parsed.data.data.name,
      username: parsed.data.data.username,
    };
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_METADATA_FAILED",
      "X metadata request failed.",
      error
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
