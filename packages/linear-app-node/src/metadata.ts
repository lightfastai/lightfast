import { z } from "zod";

import {
  assertLinearEndpointAllowed,
  DEFAULT_LINEAR_ENDPOINTS,
} from "./config";
import { LinearAppNodeError } from "./errors";

const DEFAULT_LINEAR_METADATA_TIMEOUT_MS = 10_000;

const linearViewerResponseSchema = z.object({
  data: z.object({
    viewer: z.object({
      id: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      organization: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }),
    }),
  }),
});

export interface LinearConnectorMetadata {
  actorId?: string;
  actorName?: string;
  workspaceId: string;
  workspaceName: string;
}

export async function getLinearViewerMetadata(input: {
  accessToken: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  viewerUrl?: string;
}): Promise<LinearConnectorMetadata> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_LINEAR_METADATA_TIMEOUT_MS
        );

  try {
    const viewerUrl = input.viewerUrl ?? DEFAULT_LINEAR_ENDPOINTS.viewerUrl;
    assertLinearEndpointAllowed({
      defaultValue: DEFAULT_LINEAR_ENDPOINTS.viewerUrl,
      nodeEnv: input.nodeEnv,
      value: viewerUrl,
    });

    const response = await requestFetch(viewerUrl, {
      body: JSON.stringify({
        query: `query LightfastLinearViewerMetadata {
            viewer {
              id
              name
              organization {
                id
                name
              }
            }
          }`,
      }),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal,
    });
    const json = await response.json().catch(() => null);
    const parsed = linearViewerResponseSchema.safeParse(json);

    if (!(response.ok && parsed.success)) {
      throw new LinearAppNodeError(
        "LINEAR_METADATA_FAILED",
        "Linear metadata request failed."
      );
    }

    return {
      actorId: parsed.data.data.viewer.id,
      actorName: parsed.data.data.viewer.name,
      workspaceId: parsed.data.data.viewer.organization.id,
      workspaceName: parsed.data.data.viewer.organization.name,
    };
  } catch (error) {
    if (error instanceof LinearAppNodeError) {
      throw error;
    }
    throw new LinearAppNodeError(
      "LINEAR_METADATA_FAILED",
      "Linear metadata request failed.",
      error
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
