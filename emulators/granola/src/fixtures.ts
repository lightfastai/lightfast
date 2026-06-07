export const GRANOLA_EMULATOR_FIXTURES = {
  accountName: "Granola Emulator",
  accessToken: "granola_access_valid",
  oauthClientId: "granola_emulator_local",
  refreshToken: "granola_refresh_valid",
  userId: "granola_user_emulated",
} as const;

export const GRANOLA_EMULATOR_OAUTH_CODE = "granola_oauth_code_emulator_local";

export const GRANOLA_EMULATOR_SCOPE = "notes:read meetings:read";

export const GRANOLA_EMULATOR_TOOLS = [
  {
    name: "search_notes",
    description: "Search emulated Granola meeting notes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      additionalProperties: true,
    },
  },
  {
    name: "get_note",
    description: "Get an emulated Granola note",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const;

export interface GranolaEmulatorNote {
  body: string;
  id: string;
  participants: string[];
  startedAt: string;
  summary: string;
  title: string;
}

export const GRANOLA_EMULATOR_NOTES = [
  {
    id: "granola_note_connectors",
    title: "User-first connector planning",
    startedAt: "2026-06-06T09:30:00.000Z",
    participants: ["Jeevan", "Lightfast"],
    summary:
      "Granola should be represented as a private user connector for interactive chats.",
    body: "Granola remains a private user connector because its meeting notes belong to the signed-in user. The workspace connectors UI should make the user/team boundary obvious while still letting interactive chat sessions use the user's own notes.",
  },
  {
    id: "granola_note_sharing",
    title: "Granola sharing boundary",
    startedAt: "2026-06-06T10:15:00.000Z",
    participants: ["Jeevan", "Lightfast"],
    summary:
      "Sharing should point back to the real Granola note rather than synthesizing a Lightfast-only artifact.",
    body: "The most important sharing experience is preserving the actual Granola note. Lightfast can use Granola MCP for user-authorized interactive retrieval, but sharing the source note should still respect Granola's native permission model.",
  },
] satisfies GranolaEmulatorNote[];
