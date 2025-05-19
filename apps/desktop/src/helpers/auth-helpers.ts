import Cookies from "js-cookie";

import { AccessToken, RefreshToken, TokenOrNull } from "@vendor/openauth";

export const ACCESS_TOKEN_COOKIE_NAME = "lightfast.access-token";
export const REFRESH_TOKEN_COOKIE_NAME = "lightfast.refresh-token";

export const setTokensElectronHandler = (
  access: AccessToken,
  refresh: RefreshToken,
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

export const getTokenElectronHandler = (): TokenOrNull => {
  return {
    accessToken: Cookies.get(ACCESS_TOKEN_COOKIE_NAME),
    refreshToken: Cookies.get(REFRESH_TOKEN_COOKIE_NAME),
  };
};
