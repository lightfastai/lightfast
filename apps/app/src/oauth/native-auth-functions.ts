import { listNativeAuthOrganizations } from "@api/app/tanstack/native-auth";
import {
  type NativeOrganization,
  nativeClientSchema,
} from "@repo/native-auth-contract";
import { createServerFn } from "@tanstack/react-start";
import { nativeAuthStartSearchSchema } from "./native-auth-validators";

const nativeAuthStartInputSchema = nativeAuthStartSearchSchema.extend({
  client: nativeClientSchema,
});

export const loadNativeAuthOrganizations = createServerFn({ method: "GET" })
  .inputValidator(nativeAuthStartInputSchema)
  .handler(async () => {
    const [
      { getRequest, setResponseHeader },
      { auth },
      { redirectToSignInForOAuth },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@vendor/clerk/server"),
      import("./oauth-auth-redirect"),
    ]);

    const request = getRequest();
    const authState = await auth({ treatPendingAsSignedOut: false });
    if (!authState.userId) {
      redirectToSignInForOAuth(request.url);
    }

    setResponseHeader("cache-control", "private, no-store");

    return listNativeAuthOrganizations() as Promise<NativeOrganization[]>;
  });
