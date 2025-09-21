import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { Stack, useRouter } from "expo-router";

import { Button, ButtonText } from "~/components/ui/buttons";
import { Input } from "~/components/ui/input";

const TERMS_URL = "https://lightfast.ai/terms";
const PRIVACY_URL = "https://lightfast.ai/privacy";

const EMAIL_PLACEHOLDER = "name@company.com";
const CODE_PLACEHOLDER = "Enter the 6-digit code";
const PASSWORD_PLACEHOLDER = "Your password";

const enum Step {
  Email = "email",
  Code = "code",
  Password = "password",
}

type OAuthProvider = "google" | "github";

interface MinimalOAuthResult {
  createdSessionId?: string | null;
  existingSessionId?: string | null;
  signIn?: { createdSessionId?: string | null } | null;
  signUp?: { createdSessionId?: string | null } | null;
  setActive?: (params: { session: string }) => Promise<void>;
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

  const [step, setStep] = useState<Step>(Step.Email);
  const [emailAddress, setEmailAddress] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  const resetState = () => {
    setStep(Step.Email);
    setFormError(null);
    setEmailAddress("");
    setIdentifier("");
    setPassword("");
    setCode("");
  };

  const handleOAuth = useCallback(
    (provider: OAuthProvider) =>
      async () => {
        const starter =
          provider === "google" ? startGoogleOAuth : startGithubOAuth;

        try {
          setOauthLoading(provider);
          const result = (await starter()) as MinimalOAuthResult;

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

          Alert.alert(
            "Check your email",
            "Complete the verification steps to finish signing in.",
          );
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
          "This email cannot receive a verification code. Try signing in with your password instead.",
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

  const handlePasswordSubmit = async () => {
    if (!isLoaded) return;
    if (!identifier || !password) {
      setFormError("Enter both your email (or username) and password.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const result = await signIn.create({
        identifier,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/");
        return;
      }

      setFormError("Sign in incomplete. Try another method.");
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
    badge: string,
  ) => (
    <Button
      key={provider}
      variant="inverse"
      className="gap-3"
      onPress={handleOAuth(provider)}
      disabled={oauthLoading !== null}
    >
      <View className="h-6 w-6 items-center justify-center rounded-full bg-background">
        <Text className="text-xs font-semibold text-primary">{badge}</Text>
      </View>
      <ButtonText variant="inverse" className="text-base">
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

  const showHeader = step === Step.Email || step === Step.Password;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-between gap-10">
          <View className="items-center gap-6 pt-12">
            {showHeader ? (
              <View className="items-center gap-2">
                <Text className="text-3xl font-semibold text-primary">Lightfast</Text>
                <Text className="text-center text-2xl font-semibold text-foreground">
                  Do your best work with Lightfast
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Continue with your favourite provider or sign in with email.
                </Text>
              </View>
            ) : (
              <View className="items-center gap-2">
                <Text className="text-2xl font-semibold text-foreground">
                  Enter the code we sent to {emailAddress}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Check your inbox (and spam) for a 6-digit code.
                </Text>
              </View>
            )}

            {formError ? (
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
              <View className="w-full gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Email</Text>
                  <Input
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder={EMAIL_PLACEHOLDER}
                    value={emailAddress}
                    onChangeText={setEmailAddress}
                    textContentType="emailAddress"
                    returnKeyType="next"
                  />
                </View>

                <Button
                  onPress={handleEmailSubmit}
                  disabled={submitting}
                >
                  <ButtonText className="text-base">
                    {submitting ? "Sending code…" : "Continue with Email"}
                  </ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setFormError(null);
                    setIdentifier(emailAddress);
                    setStep(Step.Password);
                  }}
                >
                  <ButtonText variant="outline" className="text-base">
                    Sign in with Password
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
                  {renderOAuthButton("google", "Continue with Google", "G")}
                  {renderOAuthButton("github", "Continue with GitHub", "GH")}
                </View>
              </View>
            ) : null}

            {!formError && step === Step.Password ? (
              <View className="w-full gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    Email or username
                  </Text>
                  <Input
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={EMAIL_PLACEHOLDER}
                    value={identifier}
                    onChangeText={setIdentifier}
                    textContentType="username"
                    returnKeyType="next"
                  />
                </View>
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Password</Text>
                  <Input
                    placeholder={PASSWORD_PLACEHOLDER}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    textContentType="password"
                    returnKeyType="done"
                  />
                </View>

                <Button onPress={handlePasswordSubmit} disabled={submitting}>
                  <ButtonText className="text-base">
                    {submitting ? "Signing in…" : "Sign in"}
                  </ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setFormError(null);
                    setPassword("");
                    setStep(Step.Email);
                  }}
                >
                  <ButtonText variant="outline">← Back to other options</ButtonText>
                </Button>
              </View>
            ) : null}

            {!formError && step === Step.Code ? (
              <View className="w-full gap-4">
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
                  />
                </View>

                <Button onPress={handleCodeSubmit} disabled={submitting}>
                  <ButtonText className="text-base">
                    {submitting ? "Verifying…" : "Verify and continue"}
                  </ButtonText>
                </Button>

                <Button variant="outline" onPress={handleResendCode}>
                  <ButtonText variant="outline">Resend code</ButtonText>
                </Button>

                <Button
                  variant="outline"
                  onPress={() => {
                    setFormError(null);
                    setCode("");
                    setStep(Step.Email);
                  }}
                >
                  <ButtonText variant="outline">← Back to other options</ButtonText>
                </Button>
              </View>
            ) : null}
          </View>

          <View className="gap-4 pb-10">
            <Text className="text-center text-xs text-muted-foreground">
              By continuing, you agree to the Lightfast Terms of Service and Privacy Policy.
            </Text>
            <View className="flex-row items-center justify-center gap-4">
              <TouchableOpacity onPress={() => openLink(TERMS_URL)}>
                <Text className="text-xs text-primary">Terms</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLink(PRIVACY_URL)}>
                <Text className="text-xs text-primary">Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
