import { describe, expect, it, vi } from "vitest";

import { getLinearViewerMetadata } from "../metadata";

describe("getLinearViewerMetadata", () => {
  it("maps Linear viewer metadata for the connected workspace and actor", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: {
          viewer: {
            id: "actor_123",
            name: "Lightfast Local",
            organization: {
              id: "workspace_123",
              name: "Lightfast",
            },
          },
        },
      })
    );

    await expect(
      getLinearViewerMetadata({
        accessToken: "lin_access",
        fetch: fetchMock,
        viewerUrl: "https://api.linear.test/graphql",
      })
    ).resolves.toEqual({
      actorId: "actor_123",
      actorName: "Lightfast Local",
      workspaceId: "workspace_123",
      workspaceName: "Lightfast",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.test/graphql",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer lin_access",
        }),
        method: "POST",
      })
    );
  });

  it("rejects direct custom viewer endpoints outside development and test", async () => {
    await expect(
      getLinearViewerMetadata({
        accessToken: "lin_access",
        nodeEnv: "production",
        viewerUrl: "https://api.linear.test/graphql",
      })
    ).rejects.toMatchObject({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" });
  });
});
