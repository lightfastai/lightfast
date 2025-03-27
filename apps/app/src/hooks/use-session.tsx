import { api } from "~/trpc/react";

export const useSession = () => {
  const { data: session } = api.app.auth.getSession.useQuery();
  return session;
};
