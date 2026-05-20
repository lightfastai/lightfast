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

type SignUpStatus = "missing_requirements" | "complete" | "abandoned";
type SignInStatus =
  | "complete"
  | "needs_first_factor"
  | "needs_second_factor"
  | "needs_new_password"
  | "needs_identifier";

interface FirstFactor {
  strategy: string;
}

interface ExistingSession {
  sessionId: string;
}

interface ClerkStub {
  loaded: boolean;
  setActive: Mock;
}

interface SignInStub {
  create: Mock;
  existingSession: ExistingSession | null;
  finalize: Mock;
  firstFactorVerification: { error: unknown } | null;
  isTransferable: boolean;
  status: SignInStatus;
  supportedFirstFactors: FirstFactor[] | null;
}

interface SignUpStub {
  create: Mock;
  existingSession: ExistingSession | null;
  finalize: Mock;
  isTransferable: boolean;
  missingFields: string[];
  status: SignUpStatus;
  update: Mock;
  verifications: {
    externalAccount: { error: unknown; status: "verified" | "unverified" };
  };
}

let clerkStub: ClerkStub;
let signInStub: SignInStub;
let signUpStub: SignUpStub;

function navigateInvoker(opts?: {
  navigate?: (a: {
    decorateUrl: (u: string) => string;
    session: { currentTask: unknown } | null;
  }) => undefined | Promise<unknown>;
}) {
  if (!opts?.navigate) {
    return;
  }
  return opts.navigate({
    decorateUrl: (u) => u,
    session: { currentTask: null },
  });
}

function makeClerkStub(): ClerkStub {
  return {
    loaded: true,
    setActive: vi.fn(async (opts?: Parameters<typeof navigateInvoker>[0]) => {
      await navigateInvoker(opts);
    }),
  };
}

function makeSignInStub(): SignInStub {
  return {
    create: vi.fn().mockResolvedValue({ error: null }),
    existingSession: null,
    finalize: vi.fn(async (opts?: Parameters<typeof navigateInvoker>[0]) => {
      await navigateInvoker(opts);
    }),
    firstFactorVerification: null,
    isTransferable: false,
    status: "needs_identifier",
    supportedFirstFactors: null,
  };
}

function makeSignUpStub(): SignUpStub {
  return {
    create: vi.fn().mockResolvedValue({ error: null }),
    existingSession: null,
    finalize: vi.fn(async (opts?: Parameters<typeof navigateInvoker>[0]) => {
      await navigateInvoker(opts);
    }),
    isTransferable: false,
    missingFields: [],
    status: "missing_requirements",
    update: vi.fn().mockResolvedValue({ error: null }),
    verifications: {
      externalAccount: { status: "unverified", error: null },
    },
  };
}

vi.mock("@vendor/clerk/client", () => ({
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
  hrefValue = "";
  searchValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: SSOCallbackPage } = await import(
  "~/app/(auth)/sso-callback/page"
);

describe("sso-callback — gating", () => {
  it("does not run state walk until clerk.loaded is true", async () => {
    clerkStub.loaded = false;
    signInStub.status = "complete";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    expect(signInStub.finalize).not.toHaveBeenCalled();
  });
});

describe("sso-callback — branch 1: signIn complete", () => {
  it("finalizes sign-in and navigates to the post-auth resolver", async () => {
    signInStub.status = "complete";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });
});

describe("sso-callback — branch 2: signUp.isTransferable", () => {
  it("transfers to sign-in then finalizes when complete", async () => {
    signUpStub.isTransferable = true;
    signInStub.create.mockImplementation(async () => {
      signInStub.status = "complete";
      return { error: null };
    });
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(signInStub.create).toHaveBeenCalledWith({ transfer: true });
    });
    await waitFor(() => {
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });

  it("bails to /sign-in when transferred sign-in stays incomplete", async () => {
    signUpStub.isTransferable = true;
    signInStub.create.mockImplementation(async () => {
      signInStub.status = "needs_first_factor";
      return { error: null };
    });
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in");
    });
  });
});

describe("sso-callback — branch 3: needs_first_factor (non-SSO)", () => {
  it("bails to /sign-in when first factor isn't enterprise SSO", async () => {
    signInStub.status = "needs_first_factor";
    signInStub.supportedFirstFactors = [{ strategy: "password" }];
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in");
    });
    expect(signInStub.finalize).not.toHaveBeenCalled();
  });
});

describe("sso-callback — branch 4: signIn.isTransferable", () => {
  it("transfers to sign-up then finalizes when complete", async () => {
    signInStub.isTransferable = true;
    signUpStub.create.mockImplementation(async () => {
      signUpStub.status = "complete";
      return { error: null };
    });
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(signUpStub.create).toHaveBeenCalledWith({
        transfer: true,
        legalAccepted: true,
      });
    });
    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });

  it("routes to /sign-up/continue when transferred sign-up has missing requirements", async () => {
    signInStub.isTransferable = true;
    signUpStub.create.mockImplementation(async () => {
      signUpStub.status = "missing_requirements";
      signUpStub.missingFields = ["legal_accepted"];
      return { error: null };
    });
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-up/continue");
    });
  });
});

describe("sso-callback — branch 5: signUp complete", () => {
  it("finalizes sign-up when signUp.status is already complete", async () => {
    signUpStub.status = "complete";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });
});

describe("sso-callback — branch 6: MFA / new password", () => {
  it("bails to /sign-in on needs_second_factor", async () => {
    signInStub.status = "needs_second_factor";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in");
    });
  });

  it("bails to /sign-in on needs_new_password", async () => {
    signInStub.status = "needs_new_password";
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in");
    });
  });
});

describe("sso-callback — branch 7: existingSession", () => {
  it("activates an existing signIn session and navigates", async () => {
    signInStub.existingSession = { sessionId: "sess_abc" };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(clerkStub.setActive).toHaveBeenCalledWith(
        expect.objectContaining({ session: "sess_abc" })
      );
    });
    expect(hrefValue).toBe("/");
  });

  it("activates an existing signUp session when signIn is empty", async () => {
    signUpStub.existingSession = { sessionId: "sess_xyz" };
    await act(async () => {
      render(<SSOCallbackPage />);
    });
    await waitFor(() => {
      expect(clerkStub.setActive).toHaveBeenCalledWith(
        expect.objectContaining({ session: "sess_xyz" })
      );
    });
    expect(hrefValue).toBe("/");
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
