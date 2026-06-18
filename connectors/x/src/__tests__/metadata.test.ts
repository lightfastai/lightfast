import { describe, expect, it, vi } from "vitest";

import { getXViewerMetadata } from "../metadata";

describe("getXViewerMetadata", () => {
  it("maps X viewer metadata for the connected account", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: {
          id: "x_user_123",
          name: "Lightfast Local",
          username: "lightfast_dev",
        },
      })
    );

    await expect(
      getXViewerMetadata({
        accessToken: "x_access",
        fetch: fetchMock,
        viewerUrl: "https://api.x.test/2/users/me",
      })
    ).resolves.toEqual({
      actorId: "x_user_123",
      actorName: "@lightfast_dev",
      name: "Lightfast Local",
      username: "lightfast_dev",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.test/2/users/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer x_access",
        }),
        method: "GET",
      })
    );
  });

  it("rejects direct custom viewer endpoints outside development and test", async () => {
    await expect(
      getXViewerMetadata({
        accessToken: "x_access",
        nodeEnv: "production",
        viewerUrl: "https://api.x.test/2/users/me",
      })
    ).rejects.toMatchObject({ code: "X_CUSTOM_ENDPOINT_FORBIDDEN" });
  });
});
