import type { OAuthStrategy } from "@clerk/types";
import { useClerk, useSignIn, useSignUp } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";

export type UseOAuthFlowParams = {
  strategy: OAuthStrategy;
  redirectUrl?: string;
  unsafeMetadata?: SignUpUnsafeMetadata;
};

export type StartOAuthFlowParams = {
  redirectUrl?: string;
  unsafeMetadata?: SignUpUnsafeMetadata;
};

// @ts-ignore
export const useOAuth = (useOAuthParams: UseOAuthFlowParams) => {
  const { strategy } = useOAuthParams || {};
  const navigate = useNavigate();
  if (!strategy) {
    throw new Error("Missing oauth strategy");
  }
  const { setActive } = useClerk();
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  async function startOAuthFlow(startOAuthFlowParams?: StartOAuthFlowParams) {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return {
        createdSessionId: "",
        signIn,
        signUp,
        setActive,
      };
    }

    // Create a redirect url for the current platform and environment.
    //
    // This redirect URL needs to be whitelisted for your Clerk production instance via
    // https://clerk.com/docs/reference/backend-api/tag/Redirect-URLs#operation/CreateRedirectURL
    //
    // For more information go to:
    // https://docs.expo.dev/versions/latest/sdk/auth-session/#authsessionmakeredirecturi
    const oauthRedirectUrl =
      startOAuthFlowParams?.redirectUrl ||
      useOAuthParams.redirectUrl ||
      `${import.meta.env.VITE_DOMAIN}/sso-callback`;
    await signIn.create({ strategy, redirectUrl: oauthRedirectUrl });

    const { externalVerificationRedirectURL } = signIn.firstFactorVerification;

    if (strategy === "oauth_google") {
      externalVerificationRedirectURL?.searchParams.set(
        "prompt",
        "select_account",
      );
    }
    window.electron.ipcRenderer.send(
      "auth:open",
      externalVerificationRedirectURL?.toString() || "",
    );

    const authCallbackOff = window.electron.ipcRenderer.on(
      "auth:callback",
      async (_event, ssoUrl: string) => {
        const url = new URL(ssoUrl);

        const params = url.searchParams;

        const rotatingTokenNonce = params.get("rotating_token_nonce") || "";
        let createdSessionId = params.get("created_session_id") || "";
        await signIn.reload({ rotatingTokenNonce });

        const { status, firstFactorVerification } = signIn;

        if (status === "complete") {
          createdSessionId = signIn.createdSessionId!;
        } else if (firstFactorVerification.status === "transferable") {
          await signUp.create({
            transfer: true,
            unsafeMetadata:
              startOAuthFlowParams?.unsafeMetadata ||
              useOAuthParams.unsafeMetadata,
          });
          createdSessionId = signUp.createdSessionId || "";
        }

        if (createdSessionId) {
          setActive({
            session: createdSessionId,
            beforeEmit: () => navigate({ to: "/" }),
          });
        } else {
          // Use signIn or signUp for next steps such as MFA
        }
        authCallbackOff();
      },
    );
  }

  return {
    startOAuthFlow,
  };
};
