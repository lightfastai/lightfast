import { openauthEnv } from "../../env";

export const getCookieName = (name: string) => {
  return openauthEnv.NODE_ENV === "production" ? `__Secure-${name}` : name;
};

export const ACCESS_TOKEN_COOKIE_NAME = getCookieName("lightfast.access-token");
export const REFRESH_TOKEN_COOKIE_NAME = getCookieName(
  "lightfast.refresh-token",
);
