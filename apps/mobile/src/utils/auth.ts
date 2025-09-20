import { getClerkInstance } from "@clerk/clerk-expo";

export const authClient = {
  async getToken() {
    try {
      const clerk = getClerkInstance();
      const token = await clerk.session?.getToken();
      return token ?? undefined;
    } catch (error) {
      console.warn("Failed to retrieve Clerk session token", error);
      return undefined;
    }
  },
};
