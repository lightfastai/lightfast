import { describe, expect, it } from "vitest";
import { X_OAUTH_SCOPES } from "../contract";
import {
  getXOperationDefinition,
  getXOperationDefinitions,
  getXToolDefinitionsForScopes,
  X_SOCIAL_WRITE_TOOL_NAMES,
} from "../operations";

describe("X operation registry", () => {
  it("includes the expected social and account write tools", () => {
    expect(X_SOCIAL_WRITE_TOOL_NAMES).toEqual([
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

  it("filters tools by granted scopes", () => {
    expect(
      getXToolDefinitionsForScopes([
        "tweet.read",
        "users.read",
        "offline.access",
      ]).map((tool) => tool.name)
    ).toEqual([
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

    expect(
      getXToolDefinitionsForScopes(X_OAUTH_SCOPES).map((tool) => tool.name)
    ).toEqual(
      expect.arrayContaining([
        "createPost",
        "likePost",
        "sendDmByConversation",
        "createCommunityNote",
      ])
    );
  });

  it("marks source-user operations for connected actor injection", () => {
    expect(getXOperationDefinition("likePost")).toMatchObject({
      method: "POST",
      path: "/2/users/{source_user_id}/likes",
      sourceUserId: "connected_actor",
    });
  });

  it("does not expose binary media upload operations", () => {
    expect(
      getXOperationDefinitions().map((operation) => operation.name)
    ).not.toEqual(
      expect.arrayContaining([
        "mediaUpload",
        "initializeMediaUpload",
        "appendMediaUpload",
        "finalizeMediaUpload",
        "chatMediaUploadInitialize",
        "chatMediaUploadAppend",
        "chatMediaUploadFinalize",
      ])
    );
  });
});
