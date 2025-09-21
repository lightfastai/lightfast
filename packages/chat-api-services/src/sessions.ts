import { ChatApiError, ChatApiService } from "./base-service";

export class SessionsService extends ChatApiService {
  async create({ id }: { id: string }): Promise<void> {
    await this.call(
      "sessions.create",
      (caller) => caller.session.create({ id }),
      {
        fallbackMessage: "Failed to create session",
        details: { sessionId: id },
        recover: (error) => {
          switch (error.code) {
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId: id },
              });
            case "FORBIDDEN":
              throw new ChatApiError({
                code: "FORBIDDEN",
                message: "Forbidden: Session belongs to another user",
                cause: error,
                details: { sessionId: id },
              });
            default:
              throw error;
          }
        },
      },
    );
  }

  async getMetadata(
    sessionId: string,
  ): Promise<{ resourceId: string; id: string } | null> {
    const session = await this.call(
      "sessions.getMetadata",
      (caller) => caller.session.getMetadata({ sessionId }),
      {
        fallbackMessage: "Failed to fetch session metadata",
        details: { sessionId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          switch (error.code) {
            case "NOT_FOUND":
              return null;
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId },
              });
            case "FORBIDDEN":
              throw new ChatApiError({
                code: "FORBIDDEN",
                message: `Session ${sessionId} access denied`,
                cause: error,
                details: { sessionId },
              });
            default:
              throw error;
          }
        },
      },
    );

    if (!session) {
      return null;
    }

    return {
      resourceId: session.clerkUserId,
      id: session.id,
    };
  }
}
