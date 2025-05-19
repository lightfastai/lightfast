import { z } from "zod";

export const $TRPCSource = z.enum(["lightfast-app", "lightfast-desktop"]);

export type TRPCSource = z.infer<typeof $TRPCSource>;

export const $TRPCHeaderName = z.enum([
  "x-lightfast-trpc-source",
  "x-lightfast-trpc-access-token",
  "x-lightfast-trpc-refresh-token",
]);

export type TRPCHeaderName = z.infer<typeof $TRPCHeaderName>;

export const createTRPCHeaders = ({
  source,
  accessToken,
  refreshToken,
}: {
  source: TRPCSource;
  accessToken?: string;
  refreshToken?: string;
}): Headers => {
  const headers = new Headers();

  // Set required headers
  headers.set($TRPCHeaderName.Enum["x-lightfast-trpc-source"], source);

  // Set optional headers
  if (accessToken) {
    headers.set(
      $TRPCHeaderName.Enum["x-lightfast-trpc-access-token"],
      accessToken,
    );
  }
  if (refreshToken) {
    headers.set(
      $TRPCHeaderName.Enum["x-lightfast-trpc-refresh-token"],
      refreshToken,
    );
  }

  return headers;
};

export const getHeaderFromTRPCHeaders = (
  headers: Headers,
  headerName: TRPCHeaderName,
): string | null => {
  return headers.get(headerName);
};
