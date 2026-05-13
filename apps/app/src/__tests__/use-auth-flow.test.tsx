import { act, renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  startSpan: <T,>(_opts: unknown, fn: () => Promise<T>) => fn(),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// vi.hoisted so the factory below can reference these.
const { mapOtpClerkErrorMock } = vi.hoisted(() => ({
  mapOtpClerkErrorMock: vi.fn<(err: unknown) => unknown>(),
}));

vi.mock("~/app/(auth)/_hooks/auth-errors", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/app/(auth)/_hooks/auth-errors")>();
  return {
    ...actual,
    mapOtpClerkError: (err: unknown) => {
      const override = mapOtpClerkErrorMock.getMockImplementation();
      return override ? override(err) : actual.mapOtpClerkError(err);
    },
  };
});

interface SignInStub {
  emailCode: {
    sendCode: Mock;
    verifyCode: Mock;
  };
  finalize: Mock;
  sso: Mock;
  status: "needs_first_factor" | "complete";
}

interface ClerkStub {
  client: {
    resetSignIn: Mock;
    resetSignUp: Mock;
    signIn: {
      authenticateWithRedirect: Mock;
      create: Mock;
    };
    signUp: {
      authenticateWithRedirect: Mock;
    };
  };
  session: { id: string } | null;
  setActive: Mock;
}

interface SignUpStub {
  create: Mock;
  emailAddress: string | null;
  finalize: Mock;
  sso: Mock;
  status: "missing_requirements" | "complete";
  verifications: {
    sendEmailCode: Mock;
    verifyEmailCode: Mock;
  };
}

let signInStub: SignInStub;
let signUpStub: SignUpStub;
let clerkStub: ClerkStub;

function makeClerkStub(): ClerkStub {
  return {
    client: {
      resetSignIn: vi.fn(),
      resetSignUp: vi.fn(),
      signIn: {
        authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({
          status: "complete",
          createdSessionId: "sess_test_123",
        }),
      },
      signUp: {
        authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
      },
    },
    setActive: vi.fn().mockResolvedValue(undefined),
    session: null,
  };
}

function makeSignInStub(): SignInStub {
  return {
    status: "needs_first_factor",
    emailCode: {
      sendCode: vi.fn().mockResolvedValue({ error: null }),
      verifyCode: vi.fn().mockResolvedValue({ error: null }),
    },
    sso: vi.fn().mockResolvedValue({ error: null }),
    finalize: vi.fn(
      async (opts?: {
        navigate?: (a: {
          decorateUrl: (u: string) => string;
        }) => undefined | Promise<unknown>;
      }) => {
        if (opts?.navigate) {
          await opts.navigate({ decorateUrl: (u) => u });
        }
      }
    ),
  };
}

function makeSignUpStub(): SignUpStub {
  return {
    status: "missing_requirements",
    emailAddress: null,
    create: vi.fn().mockResolvedValue({ error: null }),
    sso: vi.fn().mockResolvedValue({ error: null }),
    verifications: {
      sendEmailCode: vi.fn().mockResolvedValue({ error: null }),
      verifyEmailCode: vi.fn().mockResolvedValue({ error: null }),
    },
    finalize: vi.fn(
      async (opts?: {
        navigate?: (a: {
          decorateUrl: (u: string) => string;
        }) => undefined | Promise<unknown>;
      }) => {
        if (opts?.navigate) {
          await opts.navigate({ decorateUrl: (u) => u });
        }
      }
    ),
  };
}

vi.mock("@vendor/clerk/client", () => ({
  useSignIn: () => ({ signIn: signInStub }),
  useSignUp: () => ({ signUp: signUpStub }),
  useClerk: () => clerkStub,
  useAuth: () => ({ isLoaded: true }),
}));

// Install a single, persistent fake `window.location` once for the whole file
// to avoid the cross-test pollution that happens when each `beforeEach`
// redefines the property.
let hrefValue = "";
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    get href() {
      return hrefValue;
    },
    set href(v: string) {
      hrefValue = v;
    },
    assign: (v: string) => {
      hrefValue = v;
    },
  },
});

beforeEach(() => {
  signInStub = makeSignInStub();
  signUpStub = makeSignUpStub();
  clerkStub = makeClerkStub();
  hrefValue = "";
  mapOtpClerkErrorMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Import after mocks are registered.
const { useAuthFlow } = await import("~/app/(auth)/_hooks/use-auth-flow");

describe("useAuthFlow — init effect (sign-up, no ticket)", () => {
  it("fires signUp.create exactly once even when re-rendered (hasInitRef guard)", async () => {
    const { rerender } = renderHook(() =>
      useAuthFlow({ mode: "sign-up", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(signUpStub.create).toHaveBeenCalledTimes(1);
    });

    rerender();
    rerender();

    expect(signUpStub.create).toHaveBeenCalledTimes(1);
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("fires signUp.create only once under StrictMode double-mount", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );
    renderHook(
      () =>
        useAuthFlow({ mode: "sign-up", step: "code", email: "u@example.com" }),
      { wrapper }
    );

    await waitFor(() => {
      expect(signUpStub.create).toHaveBeenCalledTimes(1);
    });
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("flips isInitializing to false after init resolves", async () => {
    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-up", step: "code", email: "u@example.com" })
    );

    expect(result.current.otp.isInitializing).toBe(true);

    await waitFor(() => {
      expect(result.current.otp.isInitializing).toBe(false);
    });
  });
});

describe("useAuthFlow — init effect (sign-up + ticket)", () => {
  it("fires signUp.create({ ticket, legalAccepted }) without emailAddress under re-render", async () => {
    const { rerender } = renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
      })
    );

    await waitFor(() => {
      expect(signUpStub.create).toHaveBeenCalledTimes(1);
    });
    expect(signUpStub.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tkt_abc",
      emailAddress: "invited@example.com",
      legalAccepted: true,
    });
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);

    rerender();
    rerender();

    expect(signUpStub.create).toHaveBeenCalledTimes(1);
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("fires signUp.create only once under StrictMode", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );
    renderHook(
      () =>
        useAuthFlow({
          mode: "sign-up",
          step: "code",
          email: "invited@example.com",
          ticket: "tkt_abc",
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(signUpStub.create).toHaveBeenCalledTimes(1);
    });
    expect(signUpStub.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tkt_abc",
      emailAddress: "invited@example.com",
      legalAccepted: true,
    });
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("short-circuits sendEmailCode and finalizes when create returns status=complete", async () => {
    signUpStub.status = "complete";

    renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
      })
    );

    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(signUpStub.verifications.sendEmailCode).not.toHaveBeenCalled();
    expect(hrefValue).toBe("/account/welcome");
  });

  it("redirects to /sign-up?error=<msg> when signUp.create rejects with a generic ticket error (revoked invitation)", async () => {
    // Row 13: surfacing the error inline on ?step=code layers it over the
    // "We sent a verification code" copy — confusing. Reset to email step
    // so ErrorBanner renders cleanly.
    signUpStub.create.mockResolvedValue({
      error: {
        code: "invitation_revoked",
        message: "revoked",
        longMessage: "The invitation was revoked.",
      },
    });

    renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
      })
    );

    await waitFor(() => {
      expect(hrefValue).not.toBe("");
    });
    const url = new URL(hrefValue, "https://x");
    expect(url.pathname).toBe("/sign-up");
    expect(url.searchParams.get("error")).toBe("The invitation was revoked.");
    expect(url.searchParams.get("__clerk_ticket")).toBeNull();
    expect(signUpStub.verifications.sendEmailCode).not.toHaveBeenCalled();
  });

  it("redirects to /sign-up?error=<expired> when signUp.create rejects with ticket_expired", async () => {
    signUpStub.create.mockResolvedValue({
      error: { code: "ticket_expired", message: "expired" },
    });

    renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
      })
    );

    await waitFor(() => {
      expect(hrefValue).not.toBe("");
    });
    const url = new URL(hrefValue, "https://x");
    expect(url.pathname).toBe("/sign-up");
    expect(url.searchParams.get("error")).toBe(
      "This invitation link has expired. Request a new one."
    );
    expect(signUpStub.verifications.sendEmailCode).not.toHaveBeenCalled();
  });

  it("redirects to /sign-up?errorCode=waitlist when signUp.create rejects with sign_up_restricted_waitlist", async () => {
    signUpStub.create.mockResolvedValue({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });

    renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
      })
    );

    await waitFor(() => {
      expect(hrefValue).not.toBe("");
    });
    expect(hrefValue).toBe("/sign-up?errorCode=waitlist");
    expect(signUpStub.verifications.sendEmailCode).not.toHaveBeenCalled();
  });

  it("does NOT redirect on inline ticket error when an onWaitlistError callback is supplied for the waitlist case", async () => {
    // Sanity check: onWaitlistError diverts the waitlist branch; inline
    // errors still redirect to /sign-up?error=<msg> regardless.
    const onWaitlistError = vi.fn();
    signUpStub.create.mockResolvedValue({
      error: {
        code: "invitation_revoked",
        message: "revoked",
        longMessage: "The invitation was revoked.",
      },
    });

    renderHook(() =>
      useAuthFlow({
        mode: "sign-up",
        step: "code",
        email: "invited@example.com",
        ticket: "tkt_abc",
        onWaitlistError,
      })
    );

    await waitFor(() => {
      expect(hrefValue).not.toBe("");
    });
    expect(onWaitlistError).not.toHaveBeenCalled();
    const url = new URL(hrefValue, "https://x");
    expect(url.searchParams.get("error")).toBe("The invitation was revoked.");
  });
});

describe("useAuthFlow — activate slice", () => {
  it("fires clerk.client.signIn.create({ strategy: 'ticket' }) exactly once (hasActivatedRef guard)", async () => {
    const { rerender } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" })
    );

    await waitFor(() => {
      expect(clerkStub.client.signIn.create).toHaveBeenCalledTimes(1);
    });
    expect(clerkStub.client.signIn.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tkn_abc",
    });

    rerender();
    rerender();

    expect(clerkStub.client.signIn.create).toHaveBeenCalledTimes(1);
  });

  it("fires create only once under StrictMode", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <React.StrictMode>{children}</React.StrictMode>
    );
    renderHook(
      () =>
        useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" }),
      { wrapper }
    );

    await waitFor(() => {
      expect(clerkStub.client.signIn.create).toHaveBeenCalledTimes(1);
    });
    expect(clerkStub.client.signIn.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tkn_abc",
    });
  });

  it("calls setActive and navigates to /account/welcome on complete", async () => {
    renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" })
    );

    await waitFor(() => {
      expect(clerkStub.setActive).toHaveBeenCalledTimes(1);
    });
    expect(clerkStub.setActive).toHaveBeenCalledWith({
      session: "sess_test_123",
    });
    expect(hrefValue).toBe("/account/welcome");
  });

  it("surfaces ticket_expired's specific message instead of generic copy", async () => {
    clerkStub.client.signIn.create.mockRejectedValue({
      code: "ticket_expired",
      message: "expired",
    });

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" })
    );

    await waitFor(() => {
      expect(result.current.activate.error).toBe(
        "This invitation link has expired. Request a new one."
      );
    });
    expect(clerkStub.setActive).not.toHaveBeenCalled();
  });

  it("surfaces 'Authentication failed' fallback when error has no ClerkAPIError shape", async () => {
    // asClerkAPIError returns null for bare Errors; mapOtpClerkError emits
    // { kind: "inline", message: "Authentication failed" }.
    clerkStub.client.signIn.create.mockRejectedValue(new Error("bare error"));

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" })
    );

    await waitFor(() => {
      expect(result.current.activate.error).toBe("Authentication failed");
    });
    expect(clerkStub.setActive).not.toHaveBeenCalled();
  });

  it("sets error when create returns a non-complete status", async () => {
    clerkStub.client.signIn.create.mockResolvedValue({
      status: "needs_first_factor",
      createdSessionId: null,
    });

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "activate", token: "tkn_abc" })
    );

    await waitFor(() => {
      expect(result.current.activate.error).toBe(
        "Sign-in failed. Please try again."
      );
    });
    expect(clerkStub.setActive).not.toHaveBeenCalled();
  });
});

describe("useAuthFlow — auto-verify (sign-in)", () => {
  it("resets verifyingCodeRef on verifyError so the same code re-triggers verify after change", async () => {
    signInStub.emailCode.verifyCode.mockResolvedValueOnce({
      error: { code: "form_code_incorrect", message: "wrong" },
    });

    const { result } = renderHook(() =>
      useAuthFlow({
        mode: "sign-in",
        step: "code",
        email: "u@example.com",
      })
    );

    await waitFor(() => {
      expect(result.current.otp.isInitializing).toBe(false);
    });

    act(() => result.current.otp.onCodeChange("123456"));

    await waitFor(() => {
      expect(signInStub.emailCode.verifyCode).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.otp.error).not.toBeNull();
    });

    // User edits the code (clears error), then re-pastes the same 6 digits.
    act(() => result.current.otp.onCodeChange("12345"));
    act(() => result.current.otp.onCodeChange("123456"));

    await waitFor(() => {
      expect(signInStub.emailCode.verifyCode).toHaveBeenCalledTimes(2);
    });
  });

  it("does NOT verify until isInitializing flips to false (paste race)", async () => {
    let resolveSend: (v: { error: null }) => void = () => undefined;
    signInStub.emailCode.sendCode.mockImplementation(
      () =>
        new Promise<{ error: null }>((resolve) => {
          resolveSend = resolve;
        })
    );

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    act(() => result.current.otp.onCodeChange("123456"));

    await Promise.resolve();
    expect(signInStub.emailCode.verifyCode).not.toHaveBeenCalled();

    resolveSend({ error: null });

    await waitFor(() => {
      expect(result.current.otp.isInitializing).toBe(false);
    });

    await waitFor(() => {
      expect(signInStub.emailCode.verifyCode).toHaveBeenCalledTimes(1);
    });
  });

  it("falls through to finalize on verification_already_verified (kind: success)", async () => {
    signInStub.emailCode.verifyCode.mockResolvedValueOnce({
      error: { code: "verification_already_verified", message: "already" },
    });
    signInStub.status = "complete";

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(result.current.otp.isInitializing).toBe(false);
    });

    act(() => result.current.otp.onCodeChange("123456"));

    await waitFor(() => {
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(result.current.otp.error).toBeNull();
    expect(hrefValue).toBe("/account/welcome");
  });
});

describe("useAuthFlow — onResend", () => {
  it("early-returns while isInitializing is true (does NOT send)", async () => {
    // Keep init's sendCode pending forever so isInitializing stays true.
    signInStub.emailCode.sendCode.mockImplementationOnce(
      () => new Promise<{ error: null }>(() => undefined)
    );

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    // Init effect's call (pending).
    await waitFor(() => {
      expect(signInStub.emailCode.sendCode).toHaveBeenCalledTimes(1);
    });
    expect(result.current.otp.isInitializing).toBe(true);

    await act(async () => {
      await result.current.otp.onResend();
    });

    // onResend short-circuited — still only the init call.
    expect(signInStub.emailCode.sendCode).toHaveBeenCalledTimes(1);
  });

  it("invokes sendCode once init has resolved", async () => {
    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(result.current.otp.isInitializing).toBe(false);
    });
    expect(signInStub.emailCode.sendCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.otp.onResend();
    });

    expect(signInStub.emailCode.sendCode).toHaveBeenCalledTimes(2);
  });
});

describe("useAuthFlow — mode-aware waitlist redirect", () => {
  it("redirects sign-in waitlist errors to /sign-in?errorCode=waitlist (not /sign-up)", async () => {
    signInStub.emailCode.sendCode.mockResolvedValueOnce({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });

    renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in?errorCode=waitlist");
    });
  });

  it("redirects sign-up waitlist errors to /sign-up?errorCode=waitlist", async () => {
    signUpStub.create.mockResolvedValueOnce({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });

    renderHook(() =>
      useAuthFlow({ mode: "sign-up", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(hrefValue).toBe("/sign-up?errorCode=waitlist");
    });
  });
});

describe("useAuthFlow — bfcache reset for OAuth loading", () => {
  it("flips oauth.loading back to false on bfcache restore (pageshow persisted=true)", async () => {
    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "email" })
    );

    // Block the SDK resolution so loading stays true after initiate().
    // Production code uses clerk.client.signIn.authenticateWithRedirect for
    // the non-ticket OAuth path (sso() Future API silently no-ops against a
    // sticky verification state) — stub that instead of signInStub.sso.
    let resolveSso: (v: undefined) => void = () => {
      /* set in mock */
    };
    clerkStub.client.signIn.authenticateWithRedirect.mockImplementation(
      () => new Promise<undefined>((r) => (resolveSso = r))
    );

    await act(async () => {
      void result.current.oauth.initiate("oauth_github");
    });
    expect(result.current.oauth.loading).toBe(true);

    await act(async () => {
      const ev = new Event("pageshow");
      Object.defineProperty(ev, "persisted", { value: true });
      window.dispatchEvent(ev);
    });
    expect(result.current.oauth.loading).toBe(false);

    resolveSso(undefined);
  });

  // Placeholder so the persisted=false branch is also covered.
  it("does NOT reset oauth.loading on initial pageshow (persisted=false)", async () => {
    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "email" })
    );

    let resolveSso: (v: { error: null }) => void = () => {
      /* set in mock */
    };
    signInStub.sso.mockImplementation(
      () => new Promise((r) => (resolveSso = r))
    );

    await act(async () => {
      void result.current.oauth.initiate("oauth_github");
    });
    expect(result.current.oauth.loading).toBe(true);

    await act(async () => {
      const ev = new Event("pageshow");
      Object.defineProperty(ev, "persisted", { value: false });
      window.dispatchEvent(ev);
    });
    expect(result.current.oauth.loading).toBe(true);

    resolveSso(undefined);
  });
});

describe("useAuthFlow — kind: code non-waitlist branch (forward-compat)", () => {
  it("renders canonical banner copy from AUTH_ERROR_MESSAGES instead of dropping the error", async () => {
    // Stub the mapper to return a future AuthErrorCode discriminant — this
    // exercises handleOtpClerkError's non-waitlist `kind: "code"` branch.
    mapOtpClerkErrorMock.mockImplementation(() => ({
      kind: "code",
      errorCode: "account_not_found",
    }));

    signInStub.emailCode.sendCode.mockResolvedValueOnce({
      error: { code: "synthetic_future_code", message: "x" },
    });

    const { result } = renderHook(() =>
      useAuthFlow({ mode: "sign-in", step: "code", email: "u@example.com" })
    );

    await waitFor(() => {
      expect(result.current.otp.error).toBe(
        "No Lightfast account is linked to this GitHub account. Sign up to create one."
      );
    });
  });
});
