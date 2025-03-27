import { api } from "~/trpc/client/react";

export const useSession = () => {
  const { data: session } = api.app.auth.getSession.useQuery();
  return session;
};
