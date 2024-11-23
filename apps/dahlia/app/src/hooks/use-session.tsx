import { api } from "~/trpc/react";

export const useSession = () => {
  const { data: session } = api.auth.getSession.useQuery();
  return session;
};
