import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type * as React from "react";
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

interface SignUpStub {
  create: Mock;
  emailAddress: string | null;
  finalize: Mock;
  missingFields: string[];
  sso: Mock;
  status: "missing_requirements" | "complete";
  ticket: Mock;
}

interface ClerkStub {
  client: {
    signUp: {
      authenticateWithRedirect: Mock;
    };
  };
}

let signUpStub: SignUpStub;
let clerkStub: ClerkStub;
let searchParamsValue: URLSearchParams;
let isSignedInValue: boolean;
let isUserLoadedValue: boolean;
let routerPushMock: Mock;

function makeSignUpStub(): SignUpStub {
  return {
    status: "missing_requirements",
    emailAddress: null,
    missingFields: [],
    create: vi.fn().mockResolvedValue({ error: null }),
    ticket: vi.fn().mockResolvedValue({ error: null }),
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
    sso: vi.fn().mockResolvedValue({ error: null }),
  };
}

function makeClerkStub(): ClerkStub {
  return {
    client: {
      signUp: {
        authenticateWithRedirect: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

vi.mock("@vendor/clerk/client", () => ({
  useSignUp: () => ({ signUp: signUpStub }),
  useClerk: () => clerkStub,
  useUser: () => ({
    isLoaded: isUserLoadedValue,
    isSignedIn: isSignedInValue,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock("@vercel/microfrontends/next/client", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
    replace: (v: string) => {
      hrefValue = v;
    },
  },
});

beforeEach(() => {
  signUpStub = makeSignUpStub();
  clerkStub = makeClerkStub();
  searchParamsValue = new URLSearchParams();
  isSignedInValue = false;
  isUserLoadedValue = true;
  routerPushMock = vi.fn();
  hrefValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: AcceptInvitationPage } = await import("./page");

describe("accept-invitation — no ticket guard", () => {
  it("renders 'No Invitation Found' when __clerk_ticket is missing", () => {
    render(<AcceptInvitationPage />);
    expect(
      screen.getByRole("heading", { name: /no invitation found/i })
    ).toBeInTheDocument();
    expect(signUpStub.ticket).not.toHaveBeenCalled();
    expect(signUpStub.create).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — Accept Invitation button", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
  });

  it("calls signUp.create({strategy:'ticket',...}) and finalizes on complete", async () => {
    let createCallCount = 0;
    signUpStub.create.mockImplementation(async () => {
      createCallCount += 1;
      // Only the strategy:'ticket' shape transitions to complete (Bug A
      // family) — the test mirrors runtime: any other shape would leave
      // status missing_requirements.
      signUpStub.status = "complete";
      return { error: null };
    });

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept invitation/i })
      );
    });

    expect(createCallCount).toBe(1);
    expect(signUpStub.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tok_abc123",
      legalAccepted: true,
    });
    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/account/welcome");
  });

  it("redirects to accept-invitation?errorCode=waitlist on waitlist rejection", async () => {
    signUpStub.create.mockResolvedValue({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept invitation/i })
      );
    });

    await waitFor(() => {
      expect(hrefValue).toBe(
        "/sign-up/accept-invitation?__clerk_ticket=tok_abc123&errorCode=waitlist"
      );
    });
  });

  it("renders inline pageError on ticket_expired", async () => {
    signUpStub.create.mockResolvedValue({
      error: { code: "ticket_expired", message: "ticket expired" },
    });

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept invitation/i })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/this invitation link has expired/i)
      ).toBeInTheDocument();
    });
    expect(signUpStub.finalize).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — OAuth path (Bug D workaround)", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
  });

  it("calls signUp.create({ticket,legalAccepted}) then legacy authenticateWithRedirect", async () => {
    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with github/i })
      );
    });

    expect(signUpStub.create).toHaveBeenCalledWith({
      ticket: "tok_abc123",
      legalAccepted: true,
    });
    expect(
      clerkStub.client.signUp.authenticateWithRedirect
    ).toHaveBeenCalledWith({
      strategy: "oauth_github",
      redirectUrl: "/sso-callback?__clerk_ticket=tok_abc123",
      redirectUrlComplete: "/account/welcome",
      continueSignUp: true,
      legalAccepted: true,
    });
    expect(signUpStub.sso).not.toHaveBeenCalled();
  });

  it("redirects to accept-invitation?errorCode=waitlist when create rejects with waitlist", async () => {
    signUpStub.create.mockResolvedValue({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with github/i })
      );
    });

    await waitFor(() => {
      expect(hrefValue).toBe(
        "/sign-up/accept-invitation?__clerk_ticket=tok_abc123&errorCode=waitlist"
      );
    });
    expect(
      clerkStub.client.signUp.authenticateWithRedirect
    ).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — signed-in redirect", () => {
  it("redirects signed-in users to /account/welcome", () => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
    isSignedInValue = true;

    render(<AcceptInvitationPage />);

    expect(routerPushMock).toHaveBeenCalledWith("/account/welcome");
  });
});

describe("accept-invitation — captcha + expiry", () => {
  it("renders <div id='clerk-captcha' /> for bot protection", () => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
    render(<AcceptInvitationPage />);
    expect(document.getElementById("clerk-captcha")).not.toBeNull();
  });

  it("decodes ticket expiry from JWT payload and renders the date", () => {
    const exp = Math.floor(new Date("2099-12-31T00:00:00Z").getTime() / 1000);
    const payload = btoa(JSON.stringify({ exp }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const fakeJwt = `header.${payload}.signature`;
    searchParamsValue = new URLSearchParams({ __clerk_ticket: fakeJwt });

    render(<AcceptInvitationPage />);
    expect(screen.getByText(/invitation expires/i)).toBeInTheDocument();
    expect(screen.getByText(/2099/)).toBeInTheDocument();
  });
});

describe("accept-invitation — error banner from URL", () => {
  it("renders ErrorBanner when ?errorCode=waitlist is present alongside ticket", () => {
    searchParamsValue = new URLSearchParams(
      "__clerk_ticket=tok_abc123&errorCode=waitlist"
    );
    render(<AcceptInvitationPage />);
    expect(
      screen.getByText(/sign-ups are currently unavailable/i)
    ).toBeInTheDocument();
  });
});
