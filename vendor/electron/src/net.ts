import { net } from "electron";

type FetchLike = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => Promise<Response>;

export const electronNetFetch: FetchLike = (input, init) =>
  net.fetch(
    input instanceof URL ? input.toString() : input,
    init
  ) as Promise<Response>;
