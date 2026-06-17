export {};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      errorTitle?: string;
      suppressErrorToast?: boolean;
    };
  }
}
