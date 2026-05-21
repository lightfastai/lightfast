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

interface ClerkStub {
  client: {
    signUp: {
      create: Mock;
    };
  };
  loaded: boolean;
  setActive: Mock;
}

let clerkStub: ClerkStub;
let searchParamsValue: URLSearchParams;
let isSignedInValue: boolean;
let isUserLoadedValue: boolean;
let routerPushMock: Mock;

function makeClerkStub(): ClerkStub {
  return {
    client: {
      signUp: {
        create: vi.fn().mockResolvedValue({
          createdSessionId: "sess_123",
          missingFields: [],
          status: "complete",
        }),
      },
    },
    loaded: true,
    setActive: vi.fn(
      async (opts?: {
        navigate?: (a: {
          decorateUrl: (u: string) => string;
          session?: { currentTask?: unknown } | null;
        }) => undefined | Promise<unknown>;
      }) => {
        if (opts?.navigate) {
          await opts.navigate({ decorateUrl: (u) => u });
        }
      }
    ),
  };
}

vi.mock("@vendor/clerk", () => ({
  isClerkAPIResponseError: (err: unknown) =>
    typeof err === "object" && err !== null && "errors" in err,
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

const { default: AcceptInvitationPage } = await import(
  "~/app/(auth)/sign-up/accept-invitation/page"
);

describe("accept-invitation — no ticket guard", () => {
  it("renders 'No Invitation Found' when __clerk_ticket is missing", () => {
    render(<AcceptInvitationPage />);
    expect(
      screen.getByRole("heading", { name: /no invitation found/i })
    ).toBeInTheDocument();
    expect(clerkStub.client.signUp.create).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — Accept Invitation button", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
  });

  it("uses Clerk's ticket strategy and activates the created session", async () => {
    let createCallCount = 0;
    clerkStub.client.signUp.create.mockImplementation(async () => {
      createCallCount += 1;
      return {
        createdSessionId: "sess_invite",
        missingFields: [],
        status: "complete",
      };
    });

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept invitation/i })
      );
    });

    expect(createCallCount).toBe(1);
    expect(clerkStub.client.signUp.create).toHaveBeenCalledWith({
      strategy: "ticket",
      ticket: "tok_abc123",
      legalAccepted: true,
    });
    await waitFor(() => {
      expect(clerkStub.setActive).toHaveBeenCalledTimes(1);
    });
    expect(clerkStub.setActive).toHaveBeenCalledWith({
      session: "sess_invite",
      navigate: expect.any(Function),
    });
    expect(hrefValue).toBe("/");
  });

  it("surfaces a blocked Clerk task instead of leaving the form submitting", async () => {
    clerkStub.setActive.mockImplementationOnce(
      async (opts?: {
        navigate?: (a: {
          decorateUrl: (u: string) => string;
          session?: { currentTask?: unknown } | null;
        }) => undefined | Promise<unknown>;
      }) => {
        await opts?.navigate?.({
          decorateUrl: (u) => u,
          session: { currentTask: { key: "reset-password" } },
        });
      }
    );

    render(<AcceptInvitationPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept invitation/i })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(/additional authentication setup is required/i)
      ).toBeInTheDocument();
    });
    expect(hrefValue).toBe("");
    expect(
      screen.getByRole("button", { name: /accept invitation/i })
    ).toBeEnabled();
  });

  it("redirects to accept-invitation?errorCode=waitlist on waitlist rejection", async () => {
    clerkStub.client.signUp.create.mockRejectedValue({
      code: "sign_up_restricted_waitlist",
      message: "waitlist",
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
    clerkStub.client.signUp.create.mockRejectedValue({
      code: "ticket_expired",
      message: "ticket expired",
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
    expect(clerkStub.setActive).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — email-only auth", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
  });

  it("does not render social or test-provider invitation buttons", () => {
    render(<AcceptInvitationPage />);

    expect(
      screen.queryByRole("button", { name: /continue with github/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with test idp/i })
    ).not.toBeInTheDocument();
    expect(clerkStub.client.signUp.create).not.toHaveBeenCalled();
  });
});

describe("accept-invitation — signed-in redirect", () => {
  it("redirects signed-in users to the post-auth resolver", () => {
    searchParamsValue = new URLSearchParams("__clerk_ticket=tok_abc123");
    isSignedInValue = true;

    render(<AcceptInvitationPage />);

    expect(routerPushMock).toHaveBeenCalledWith("/");
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
