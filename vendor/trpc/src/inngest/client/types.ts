export type Events = {
  "apps-chat/generate-title": {
    data: {
      sessionId: string;
      userId: string;
      firstMessage: string;
    };
  };
};
