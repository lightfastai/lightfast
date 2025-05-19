import Cookies from "js-cookie";

import { $SessionType, UserSession } from "@vendor/openauth";
import { verifyToken } from "@vendor/openauth/server/auth-functions/core";

const ACCESS_TOKEN_COOKIE_NAME = "lightfast.access-token";
const REFRESH_TOKEN_COOKIE_NAME = "lightfast.refresh-token";

export const getSessionFromCookiesElectronHandler =
  async (): Promise<UserSession | null> => {
    const accessToken = Cookies.get(ACCESS_TOKEN_COOKIE_NAME);
    const refreshToken = Cookies.get(REFRESH_TOKEN_COOKIE_NAME);

    if (!accessToken) {
      return null;
    }

    const verified = await verifyToken(accessToken, refreshToken ?? undefined);

    if (verified.err) {
      return null;
    }

    if (verified.tokens) {
      setTokensElectronHandler(
        verified.tokens.access,
        verified.tokens.refresh,
        verified.tokens.expiresIn,
      );
    }

    return {
      type: $SessionType.Enum.user,
      user: {
        id: verified.subject.properties.id,
        accessToken,
        refreshToken: refreshToken ?? "",
      },
    };
  };

export const setTokensElectronHandler = (
  access: string,
  refresh: string,
  expiresIn: number,
) => {
  Cookies.set(ACCESS_TOKEN_COOKIE_NAME, access, {
    secure: true,
    sameSite: "lax",
    expires: expiresIn,
    path: "/",
  });

  if (refresh) {
    Cookies.set(REFRESH_TOKEN_COOKIE_NAME, refresh, {
      secure: true,
      sameSite: "lax",
      expires: expiresIn,
      path: "/",
    });
  }
};

export const clearTokensElectronHandler = () => {
  Cookies.remove(ACCESS_TOKEN_COOKIE_NAME);
  Cookies.remove(REFRESH_TOKEN_COOKIE_NAME);
};

export const getTokenElectronHandler = (): {
  accessToken: string | null;
  refreshToken: string | null;
} => {
  return {
    accessToken: Cookies.get(ACCESS_TOKEN_COOKIE_NAME) ?? null,
    refreshToken: Cookies.get(REFRESH_TOKEN_COOKIE_NAME) ?? null,
  };
};
