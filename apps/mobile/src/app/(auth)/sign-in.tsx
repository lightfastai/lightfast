import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  Alert,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";

import { Button, ButtonText } from "~/components/ui/buttons";
import { Input } from "~/components/ui/input";
import { GithubIcon, GoogleIcon, LogoIcon } from "~/components/ui/icons";
import type { SvgProps } from "react-native-svg";

const TERMS_URL = "https://lightfast.ai/legal/terms";
const PRIVACY_URL = "https://lightfast.ai/legal/privacy";

const EMAIL_PLACEHOLDER = "name@company.com";
const CODE_PLACEHOLDER = "Enter the 6-digit code";
const enum Step {
  Email = "email",
  Code = "code",
}

type OAuthProvider = "google" | "github";

interface MinimalOAuthStatus {
  createdSessionId?: string | null;
  status?: string | null;
}

interface MinimalOAuthResult {
  createdSessionId?: string | null;
  existingSessionId?: string | null;
  signIn?: MinimalOAuthStatus | null;
  signUp?: MinimalOAuthStatus | null;
  setActive?: (params: { session: string }) => Promise<void>;
  authSessionResult?: { type?: string | null } | null;
}

interface ClerkErrorPayload {
  errors?: { message?: string }[];
}

const extractClerkError = (err: unknown): string => {
  if (typeof err === "object" && err !== null) {
    const payload = err as ClerkErrorPayload;
    const message = payload.errors?.[0]?.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return "Something went wrong. Please try again.";
};

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow: startGoogleOAuth } = useOAuth({
    strategy: "oauth_google",
  });
  const { startOAuthFlow: startGithubOAuth } = useOAuth({
    strategy: "oauth_github",
  });
  const { height } = useWindowDimensions();

  const [step, setStep] = useState<Step>(Step.Email);
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  // Center the form vertically within available space below the logo

  const resetState = () => {
    setStep(Step.Email);
    setFormError(null);
    setEmailAddress("");
    setCode("");
  };

  // Auto-submit when 6 digits are entered (align with web auth UI)
  useEffect(() => {
    if (step === Step.Code && code.length === 6 && !submitting) {
      void handleCodeSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, code, submitting]);

  const handleOAuth = useCallback(
    (provider: OAuthProvider) =>
      async () => {
        const starter =
          provider === "google" ? startGoogleOAuth : startGithubOAuth;

        try {
          setOauthLoading(provider);
          const result = (await starter()) as MinimalOAuthResult | null;

          if (!result) {
            return;
          }

          // If the user cancelled/dismissed the provider sheet, bail quietly
          const authType = result.authSessionResult?.type;
          if (authType && authType !== "success") {
            return;
          }

          let sessionId: string | null = null;
          if (
            typeof result.createdSessionId === "string" &&
            result.createdSessionId.length > 0
          ) {
            sessionId = result.createdSessionId;
          } else if (
            typeof result.signIn?.createdSessionId === "string" &&
            result.signIn.createdSessionId.length > 0
          ) {
            sessionId = result.signIn.createdSessionId;
          } else if (
            typeof result.signUp?.createdSessionId === "string" &&
            result.signUp.createdSessionId.length > 0
          ) {
            sessionId = result.signUp.createdSessionId;
          } else if (
            typeof result.existingSessionId === "string" &&
            result.existingSessionId.length > 0
          ) {
            sessionId = result.existingSessionId;
          }

          if (sessionId) {
            if (result.setActive) {
              await result.setActive({ session: sessionId });
              router.replace("/");
              return;
            }
            console.warn("OAuth flow returned a session without setActive");
          }

          // If we reach here without a session, either the user canceled
          // or the provider flow didn't complete. Avoid noisy alerts.
          // Users can try again or use another method.
        } catch (err: unknown) {
          console.error("OAuth sign-in failed", err);
          Alert.alert("Unable to sign in", "Please try again.");
        } finally {
          setOauthLoading(null);
        }
      },
    [router, startGithubOAuth, startGoogleOAuth],
  );

  const handleEmailSubmit = async () => {
    if (!isLoaded) return;
    if (!emailAddress) {
      setFormError("Enter a valid email address to continue.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await signIn.create({ identifier: emailAddress });

      const emailFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );

      if (!emailFactor?.emailAddressId) {
        setFormError(
          "This email cannot receive a verification code right now. Please try again later.",
        );
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });

      setStep(Step.Code);
      setFormError(null);
    } catch (err) {
      const message = extractClerkError(err);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!isLoaded) return;
    if (!code) {
      setFormError("Enter the verification code that was emailed to you.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const attempt = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace("/");
        return;
      }

      setFormError("We couldn’t verify that code. Try again.");
    } catch (err) {
      const message = extractClerkError(err);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded) return;

    try {
      const emailFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      );
      if (!emailFactor?.emailAddressId) {
        setFormError("Unable to resend the code right now.");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId,
      });
      Alert.alert("Verification code sent", "Check your email again for a new code.");
    } catch (err) {
      const message = extractClerkError(err);
      setFormError(message);
    }
  };

  const renderOAuthButton = (
    provider: OAuthProvider,
    label: string,
    IconComponent: ComponentType<SvgProps>,
  ) => (
    <Button
      key={provider}
      variant="outline"
      className="flex-row items-center gap-3"
      onPress={handleOAuth(provider)}
      disabled={oauthLoading !== null}
    >
      <View className="h-6 w-6 items-center justify-center rounded-full bg-background">
        <IconComponent
          width={16}
          height={16}
        />
      </View>
      <ButtonText variant="outline" className="text-base">
        {oauthLoading === provider
          ? `Contacting ${provider === "google" ? "Google" : "GitHub"}…`
          : label}
      </ButtonText>
    </Button>
  );

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert("Unable to open link");
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-between gap-10">
          <View className="flex-1 pt-2">
            <View className="items-center">
              <LogoIcon
                color="hsl(0, 0%, 71%)"
                width={120}
                height={16}
              />
            </View>

            <View className="flex-1 w-full justify-center">
              {formError && step === Step.Email ? (
                <View className="w-full gap-4">
                  <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <Text className="text-sm text-destructive-foreground">
                      {formError}
                    </Text>
                  </View>
                  <Button variant="outline" onPress={resetState}>
                    <ButtonText variant="outline">Try again</ButtonText>
                  </Button>
                </View>
              ) : null}

              {!formError && step === Step.Email ? (
                <View className="w-full gap-5">
                  <View className="items-center">
                    <Text className="text-center text-2xl font-semibold text-foreground">
                      Log in to Lightfast
                    </Text>
                  </View>
                  <Input
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={EMAIL_PLACEHOLDER}
                    value={emailAddress}
                    onChangeText={setEmailAddress}
                    textContentType="emailAddress"
                    returnKeyType="next"
                    className="bg-background"
                  />

                  <Button
                    onPress={handleEmailSubmit}
                    disabled={submitting}
                  >
                    <ButtonText className="text-base">
                      {submitting ? "Sending code…" : "Continue with Email"}
                    </ButtonText>
                  </Button>

                  <View className="flex-row items-center gap-4">
                    <View className="h-px flex-1 bg-border" />
                    <Text className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Or
                    </Text>
                    <View className="h-px flex-1 bg-border" />
                  </View>

                  <View className="gap-3">
                    {renderOAuthButton("google", "Continue with Google", GoogleIcon)}
                    {renderOAuthButton("github", "Continue with GitHub", GithubIcon)}
                  </View>

                  <View className="pt-4">
                    <Text className="text-center text-sm text-muted-foreground">
                      By continuing, you agree to the Lightfast{' '}
                      <Text
                        className="underline text-primary"
                        onPress={() => openLink(TERMS_URL)}
                      >
                        Terms of Service
                      </Text>
                      {' '}and{' '}
                      <Text
                        className="underline text-primary"
                        onPress={() => openLink(PRIVACY_URL)}
                      >
                        Privacy Policy
                      </Text>
                      .
                    </Text>
                  </View>
                </View>
              ) : null}
              {step === Step.Code ? (
                <View className="w-full gap-4">
                  <View className="items-center gap-2">
                    <Text className="text-center text-2xl font-semibold text-foreground">
                      Verification
                    </Text>
                    <Text className="text-center text-sm text-muted-foreground">
                      We sent a verification code to <Text className="font-medium">{emailAddress}</Text>
                    </Text>
                  </View>
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-foreground">
                      Verification code
                    </Text>
                    <Input
                      autoCapitalize="none"
                      keyboardType="number-pad"
                      placeholder={CODE_PLACEHOLDER}
                      value={code}
                      onChangeText={setCode}
                      className="tracking-[0.3em] text-center"
                      textContentType="oneTimeCode"
                      returnKeyType="done"
                      maxLength={6}
                      invalid={!!formError}
                    />
                  </View>

                  {/* Inline error (matches web auth inline error behavior) */}
                  {formError ? (
                    <Text className="text-sm text-destructive-foreground">
                      {formError}
                    </Text>
                  ) : null}

                  {/* Verifying indicator */}
                  {submitting ? (
                    <View className="flex-row items-center justify-center gap-2">
                      <ActivityIndicator size="small" />
                      <Text className="text-sm text-muted-foreground">Verifying…</Text>
                    </View>
                  ) : null}

                  {/* Back link-style button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      setFormError(null);
                      setCode("");
                      setStep(Step.Email);
                    }}
                    disabled={submitting}
                  >
                    <ButtonText variant="ghost" size="sm" className="text-primary">
                      ← Back
                    </ButtonText>
                  </Button>

                  {/* Resend link-style with helper text */}
                  <View className="flex-row justify-center items-center gap-1">
                    <Text className="text-sm text-muted-foreground">Didn't receive your code?</Text>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={handleResendCode}
                      disabled={submitting}
                      fullWidth={false}
                      className="px-0"
                    >
                      <ButtonText variant="ghost" size="sm" className="text-primary">Resend</ButtonText>
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
