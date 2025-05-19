import { client } from "../root";
import { authSubjects } from "../subjects";

export const verifyToken = async (token: string, refreshToken?: string) => {
  return await client.verify(authSubjects, token, {
    refresh: refreshToken ?? undefined,
  });
};
