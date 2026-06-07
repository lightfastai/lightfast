export const X_EMULATOR_FIXTURES = {
  oauthClientId: "x_emulator_local",
  oauthClientSecret: "x-local-secret",
  userId: "x_user_1",
  userName: "Emulator User",
  username: "emulator",
  accessToken: "x_access_valid",
  refreshToken: "x_refresh_valid",
} as const;

export const X_EMULATOR_OAUTH_CODE = "x_oauth_code_emulator_local";

export const X_EMULATOR_SCOPE = "tweet.read users.read offline.access";

export const X_EMULATOR_USERS = [
  {
    description: "Builds local emulators for signal enrichment.",
    id: "x_user_1",
    location: "Melbourne, Australia",
    name: "Emulator User",
    url: "https://lightfast.ai",
    username: "emulator",
  },
  {
    description: "Runs agent workflow tests.",
    id: "x_user_2",
    location: "San Francisco, CA",
    name: "Agent",
    url: "https://agent.lightfast.ai",
    username: "agent",
  },
] as const;

export const X_EMULATOR_POSTS = [
  {
    id: "tweet_1",
    text: "Emulator connector test post",
    author_id: "x_user_1",
  },
  {
    id: "tweet_2",
    text: "Agent runtime test post",
    author_id: "x_user_2",
  },
] as const;
