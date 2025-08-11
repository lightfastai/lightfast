import { z } from "zod";

export const $TRPCSource = z.enum([
  // Client sources
  "lightfast-chat",
  "lightfast-www", 
  "lightfast-playground",
  "lightfast-experimental",
  "lightfast-cloud",
  
  // Server (RSC) sources
  "lightfast-chat-rsc",
  "lightfast-www-rsc",
  "lightfast-playground-rsc",
  "lightfast-experimental-rsc",
  "lightfast-cloud-rsc",
]);

export type TRPCSource = z.infer<typeof $TRPCSource>;

export const $TRPCHeaderName = z.enum([
  "x-lightfast-trpc-source",
]);

export type TRPCHeaderName = z.infer<typeof $TRPCHeaderName>;

export const createTRPCHeaders = ({
  source,
}: {
  source: TRPCSource;
}): Headers => {
  const headers = new Headers();

  // Set required headers
  headers.set($TRPCHeaderName.Enum["x-lightfast-trpc-source"], source);

  return headers;
};

export const getHeaderFromTRPCHeaders = (
  headers: Headers,
  headerName: TRPCHeaderName,
): string | null => {
  return headers.get(headerName);
};