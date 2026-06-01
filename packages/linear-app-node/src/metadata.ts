import { z } from "zod";

import { DEFAULT_LINEAR_ENDPOINTS } from "./config";
import { LinearAppNodeError } from "./errors";

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
  workspaceId: string;
  workspaceName: string;
  actorId?: string;
  actorName?: string;
}

export async function getLinearViewerMetadata(input: {
  accessToken: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  viewerUrl?: string;
}): Promise<LinearConnectorMetadata> {
  const requestFetch = input.fetch ?? fetch;

  try {
    const response = await requestFetch(
      input.viewerUrl ?? DEFAULT_LINEAR_ENDPOINTS.viewerUrl,
      {
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
        signal: input.signal,
      }
    );
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
  }
}
