import { describe, expect, it, vi } from "vitest";

import { executeXApiTool, X_TOOL_DEFINITIONS } from "../tools";

describe("X_TOOL_DEFINITIONS", () => {
  it("exposes the curated read-only v1 tool list", () => {
    expect(X_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "getUsersMe",
      "getUsersByUsername",
      "getUsersByUsernames",
      "getUsersById",
      "getUsersByIds",
      "getPostsById",
      "getPostsByIds",
      "searchPostsRecent",
      "getPostsCountsRecent",
    ]);
  });
});

describe("executeXApiTool", () => {
  it("routes getUsersByUsername to the X API with bearer auth", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: {
          id: "x_user_123",
          name: "Lightfast",
          username: "lightfast",
        },
      })
    );

    await expect(
      executeXApiTool({
        accessToken: "x_access",
        apiOrigin: "https://api.x.test",
        fetch: fetchMock,
        input: { username: "lightfast" },
        name: "getUsersByUsername",
      })
    ).resolves.toEqual({
      structuredContent: {
        data: {
          id: "x_user_123",
          name: "Lightfast",
          username: "lightfast",
        },
      },
      content: [{ text: "X tool getUsersByUsername completed.", type: "text" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.test/2/users/by/username/lightfast",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer x_access",
        }),
        method: "GET",
      })
    );
  });

  it("rejects write-capable or unknown tool names", async () => {
    await expect(
      executeXApiTool({
        accessToken: "x_access",
        apiOrigin: "https://api.x.test",
        input: {},
        name: "createPost",
      })
    ).rejects.toMatchObject({ code: "X_TOOL_CALL_FAILED" });
  });
});
