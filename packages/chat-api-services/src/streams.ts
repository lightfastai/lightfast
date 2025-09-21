import { ChatApiError, ChatApiService } from "./base-service";

export class StreamsService extends ChatApiService {
  async setActive({
    sessionId,
    streamId,
  }: {
    sessionId: string;
    streamId: string;
  }): Promise<void> {
    await this.call(
      "streams.setActive",
      (caller) => caller.session.setActiveStream({ sessionId, streamId }),
      {
        fallbackMessage: "Failed to set active stream",
        details: { sessionId, streamId },
        recover: (error) => {
          switch (error.code) {
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId },
              });
            case "FORBIDDEN":
            case "NOT_FOUND":
              throw new ChatApiError({
                code: error.code,
                message: `Session ${sessionId} not found or access denied`,
                cause: error,
                details: { sessionId },
              });
            default:
              throw error;
          }
        },
      },
    );
  }

  async getActive(sessionId: string): Promise<string | null> {
    const result = await this.call(
      "streams.getActive",
      (caller) => caller.session.getActiveStream({ sessionId }),
      {
        fallbackMessage: "Failed to fetch active stream",
        details: { sessionId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          if (error.code === "NOT_FOUND") {
            return null;
          }

          if (error.code === "UNAUTHORIZED") {
            throw new ChatApiError({
              code: "UNAUTHORIZED",
              message: "Unauthorized: User session expired or invalid",
              cause: error,
              details: { sessionId },
            });
          }

          throw error;
        },
      },
    );

    return result?.activeStreamId ?? null;
  }

  async getAll(sessionId: string): Promise<string[]> {
    const result = await this.call(
      "streams.getAll",
      (caller) => caller.session.getActiveStream({ sessionId }),
      {
        fallbackMessage: "Failed to fetch session streams",
        details: { sessionId },
        suppressCodes: ["NOT_FOUND"],
        recover: (error) => {
          if (error.code === "NOT_FOUND") {
            return null;
          }

          if (error.code === "UNAUTHORIZED") {
            throw new ChatApiError({
              code: "UNAUTHORIZED",
              message: "Unauthorized: User session expired or invalid",
              cause: error,
              details: { sessionId },
            });
          }

          throw error;
        },
      },
    );

    if (!result?.activeStreamId) {
      return [];
    }

    return [result.activeStreamId];
  }

  async clearActive(sessionId: string): Promise<void> {
    await this.call(
      "streams.clearActive",
      (caller) => caller.session.clearActiveStream({ sessionId }),
      {
        fallbackMessage: "Failed to clear active stream",
        details: { sessionId },
        recover: (error) => {
          switch (error.code) {
            case "UNAUTHORIZED":
              throw new ChatApiError({
                code: "UNAUTHORIZED",
                message: "Unauthorized: User session expired or invalid",
                cause: error,
                details: { sessionId },
              });
            case "FORBIDDEN":
            case "NOT_FOUND":
              throw new ChatApiError({
                code: error.code,
                message: `Session ${sessionId} not found or access denied`,
                cause: error,
                details: { sessionId },
              });
            default:
              throw error;
          }
        },
      },
    );
  }
}
