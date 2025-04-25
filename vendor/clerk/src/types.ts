export interface Session {
  user: {
    id: string;
    clerkId: string;
  };
}

export type { ClerkAPIError } from "@clerk/types";
