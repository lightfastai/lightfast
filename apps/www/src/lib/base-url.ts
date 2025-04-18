import { env } from "~/env";

export const getBaseApiUrl = () => {
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}/api`;
  // eslint-disable-next-line no-restricted-properties
  return `http://localhost:${process.env.PORT ?? 3000}/api`;
};
