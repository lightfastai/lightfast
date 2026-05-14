import { act, render, waitFor } from "@testing-library/react";
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

interface ClerkStub {
  handleRedirectCallback: Mock;
  user: { id: string } | null;
}

interface SignInStub {
  finalize: Mock;
  firstFactorVerification: { error: unknown } | null;
}

interface SignUpStub {
  finalize: Mock;
  missingFields: string[];
  status: "missing_requirements" | "complete";
  update: Mock;
  verifications: {
    externalAccount: { status: "verified" | "unverified"; error: unknown };
  };
}

let clerkStub: ClerkStub;
let signInStub: SignInStub;
let signUpStub: SignUpStub;
let isLoadedValue: boolean;

function makeClerkStub(): ClerkStub {
  return {
    user: null,
    handleRedirectCallback: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSignInStub(): SignInStub {
  return {
    firstFactorVerification: null,
    finalize: vi.fn(),
  };
}

function makeSignUpStub(): SignUpStub {
  return {
    status: "missing_requirements",
    missingFields: [],
    verifications: {
      externalAccount: { status: "unverified", error: null },
    },
    update: vi.fn().mockResolvedValue({ error: null }),
    finalize: vi.fn(
      async (opts?: {
        navigate?: (a: {
          session: { currentTask: unknown } | null;
          decorateUrl: (u: string) => string;
        }) => undefined | Promise<unknown>;
      }) => {
        if (opts?.navigate) {
          await opts.navigate({
            session: { currentTask: null },
            decorateUrl: (u) => u,
          });
        }
      }
    ),
  };
}

vi.mock("@vendor/clerk/client", () => ({
  useAuth: () => ({ isLoaded: isLoadedValue }),
  useClerk: () => clerkStub,
  useSignIn: () => ({ signIn: signInStub }),
  useSignUp: () => ({ signUp: signUpStub }),
}));

let hrefValue = "";
let searchValue = "";
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    get href() {
      return hrefValue;
    },
    set href(v: string) {
      hrefValue = v;
    },
    get search() {
      return searchValue;
    },
    assign: (v: string) => {
      hrefValue = v;
    },
    replace: (v: string) => {
      hrefValue = v;
    },
  },
});

beforeEach(() => {
  clerkStub = makeClerkStub();
  signInStub = makeSignInStub();
  signUpStub = makeSignUpStub();
  isLoadedValue = true;
  hrefValue = "";
  searchValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: SSOCallbackPage } = await import("./page");

describe("sso-callback — gating", () => {
  it("does not call handleRedirectCallback until isLoaded is true", async () => {
    isLoadedValue = false;
    render(<SSOCallbackPage />);
    expect(clerkStub.handleRedirectCallback).not.toHaveBeenCalled();
  });

  it("calls handleRedirectCallback once gates pass", async () => {
    clerkStub.user = { id: "user_abc" };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(clerkStub.handleRedirectCallback).toHaveBeenCalledTimes(1);
    });
    expect(clerkStub.handleRedirectCallback).toHaveBeenCalledWith({
      signInFallbackRedirectUrl: "/account/welcome",
      signUpFallbackRedirectUrl: "/account/welcome",
      continueSignUpUrl: "/sign-in?errorCode=account_not_found",
    });
  });
});

describe("sso-callback — happy path", () => {
  it("navigates to /account/welcome when clerk.user is populated", async () => {
    clerkStub.user = { id: "user_abc" };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/account/welcome");
    });
  });
});

describe("sso-callback — inbound errors", () => {
  it("routes waitlist rejection on signIn to /sign-in?errorCode=waitlist", async () => {
    signInStub.firstFactorVerification = {
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in?errorCode=waitlist");
    });
  });

  it("routes waitlist rejection on signUp with ticket back to accept-invitation", async () => {
    searchValue = "?__clerk_ticket=tok_abc123";
    signUpStub.verifications.externalAccount = {
      status: "unverified",
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe(
        "/sign-up/accept-invitation?__clerk_ticket=tok_abc123&errorCode=waitlist"
      );
    });
  });
});

describe("sso-callback — legal_accepted reconciliation", () => {
  it("calls signUp.update({legalAccepted}) then finalize when only legal_accepted is missing", async () => {
    signUpStub.status = "missing_requirements";
    signUpStub.missingFields = ["legal_accepted"];
    signUpStub.verifications.externalAccount = {
      status: "verified",
      error: null,
    };
    signUpStub.update.mockImplementation(async () => {
      signUpStub.status = "complete";
      return { error: null };
    });

    await act(async () => {
      render(<SSOCallbackPage />);
    });

    await waitFor(() => {
      expect(signUpStub.update).toHaveBeenCalledWith({ legalAccepted: true });
    });
    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/account/welcome");
  });
});

describe("sso-callback — fallthrough", () => {
  it("bails to /sign-in when nothing matches", async () => {
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in");
    });
  });

  it("preserves __clerk_ticket on fallthrough by routing to accept-invitation", async () => {
    searchValue = "?__clerk_ticket=tok_abc123";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe(
        "/sign-up/accept-invitation?__clerk_ticket=tok_abc123"
      );
    });
  });
});

describe("sso-callback — captcha mount", () => {
  it("renders <div id='clerk-captcha' /> for bot protection", async () => {
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    expect(document.getElementById("clerk-captcha")).not.toBeNull();
  });
});
