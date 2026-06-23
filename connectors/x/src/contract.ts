export const X_OAUTH_SCOPES = [
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
] as const;

export const X_OAUTH_SCOPE = X_OAUTH_SCOPES.join(" ");

export type XOAuthScope = (typeof X_OAUTH_SCOPES)[number];
