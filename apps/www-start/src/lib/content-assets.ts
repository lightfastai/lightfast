import { clientEnv } from "~/env/client";

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/$/, "");
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return `${base}${pathname}`;
}

export function resolveContentAssetSrc(src: string | undefined) {
  if (!src?.startsWith("/images/")) {
    return src;
  }

  if (import.meta.env.DEV) {
    return joinUrl(clientEnv.VITE_WWW_START_URL, src);
  }

  return src;
}
