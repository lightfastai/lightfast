import { describe, expect, it, vi } from "vitest";

import { executeXApiTool, X_TOOL_DEFINITIONS } from "../tools";

describe("X_TOOL_DEFINITIONS", () => {
  it("exposes the curated social account tool list", () => {
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
      "createPost",
      "deletePost",
      "repostPost",
      "unrepostPost",
      "hideReply",
      "likePost",
      "unlikePost",
      "createBookmark",
      "deleteBookmark",
      "followUser",
      "unfollowUser",
      "muteUser",
      "unmuteUser",
      "blockUser",
      "unblockUser",
      "blockDms",
      "unblockDms",
      "createList",
      "updateList",
      "deleteList",
      "addListMember",
      "removeListMember",
      "followList",
      "unfollowList",
      "pinList",
      "unpinList",
      "createDmConversation",
      "sendDmByParticipant",
      "sendDmByConversation",
      "deleteDmEvent",
      "createChatConversation",
      "initializeChatGroup",
      "initializeChatConversationKeys",
      "addChatGroupMembers",
      "sendChatMessage",
      "markChatConversationRead",
      "sendChatTypingIndicator",
      "addUserPublicKey",
      "createMediaMetadata",
      "createMediaSubtitles",
      "deleteMediaSubtitles",
      "createCommunityNote",
      "deleteCommunityNote",
      "evaluateCommunityNote",
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

  it("executes JSON write operations with connected actor path injection", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { liked: true } })
    );

    await expect(
      executeXApiTool({
        accessToken: "x_access",
        apiOrigin: "https://api.x.test",
        connectedActorId: "x_user_1",
        fetch: fetchMock,
        input: { tweet_id: "tweet_123" },
        name: "likePost",
      })
    ).resolves.toEqual({
      structuredContent: { data: { liked: true } },
      content: [{ text: "X tool likePost completed.", type: "text" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.test/2/users/x_user_1/likes",
      expect.objectContaining({
        body: JSON.stringify({ tweet_id: "tweet_123" }),
        headers: expect.objectContaining({
          "content-type": "application/json",
          authorization: "Bearer x_access",
        }),
        method: "POST",
      })
    );
  });

  it("executes path-only delete operations without a request body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { deleted: true } })
    );

    await executeXApiTool({
      accessToken: "x_access",
      apiOrigin: "https://api.x.test",
      fetch: fetchMock,
      input: { id: "tweet_123" },
      name: "deletePost",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.test/2/tweets/tweet_123",
      expect.objectContaining({
        body: undefined,
        method: "DELETE",
      })
    );
  });

  it("requires connected actor id for source-user operations", async () => {
    await expect(
      executeXApiTool({
        accessToken: "x_access",
        apiOrigin: "https://api.x.test",
        input: { tweet_id: "tweet_123" },
        name: "likePost",
      })
    ).rejects.toMatchObject({ code: "X_TOOL_CALL_FAILED" });
  });

  it("rejects unknown tool names", async () => {
    await expect(
      executeXApiTool({
        accessToken: "x_access",
        apiOrigin: "https://api.x.test",
        input: {},
        name: "unknownTool",
      })
    ).rejects.toMatchObject({ code: "X_TOOL_CALL_FAILED" });
  });
});
