import { describe, expect, it } from "vitest";

import { X_OAUTH_SCOPE, X_OAUTH_SCOPES } from "../contract";
import { X_OAUTH_SCOPE as runtimeXOAuthScope } from "../oauth";

describe("X connector contract", () => {
  it("owns the public OAuth scope contract separately from OAuth runtime code", () => {
    expect(X_OAUTH_SCOPES).toEqual([
      "tweet.read",
      "users.read",
      "offline.access",
      "tweet.write",
      "tweet.moderate.write",
      "follows.read",
      "follows.write",
      "mute.read",
      "mute.write",
      "like.read",
      "like.write",
      "list.read",
      "list.write",
      "block.read",
      "block.write",
      "bookmark.read",
      "bookmark.write",
      "dm.read",
      "dm.write",
      "media.write",
    ]);
    expect(X_OAUTH_SCOPE).toBe(X_OAUTH_SCOPES.join(" "));
    expect(runtimeXOAuthScope).toBe(X_OAUTH_SCOPE);
  });
});
