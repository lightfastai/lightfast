import "@tanstack/react-start/server-only";

import { env } from "./env";

export const appUrl = env.VITE_LIGHTFAST_APP_URL;
export const wwwUrl = env.VITE_LIGHTFAST_WWW_URL;

export const directAppUrl = process.env.PORTLESS_URL;
