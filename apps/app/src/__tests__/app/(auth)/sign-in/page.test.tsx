import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

interface SignInStub {
  emailCode: {
    sendCode: Mock;
    verifyCode: Mock;
  };
  finalize: Mock;
  sso: Mock;
  status: "needs_first_factor" | "complete";
}

let signInStub: SignInStub;
let searchParamsValue: URLSearchParams;

function makeSignInStub(): SignInStub {
  return {
    status: "needs_first_factor",
    emailCode: {
      sendCode: vi.fn().mockResolvedValue({ error: null }),
      verifyCode: vi.fn().mockResolvedValue({ error: null }),
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
    sso: vi.fn().mockResolvedValue({ error: null }),
  };
}

vi.mock("@vendor/clerk", () => ({
  isClerkAPIResponseError: (err: unknown) =>
    typeof err === "object" && err !== null && "errors" in err,
  useSignIn: () => ({ signIn: signInStub }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
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
  signInStub = makeSignInStub();
  searchParamsValue = new URLSearchParams();
  hrefValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: SignInPage } = await import("~/app/(auth)/sign-in/page");

describe("sign-in — email submit", () => {
  it("calls signIn.emailCode.sendCode and transitions to OTP view on success", async () => {
    render(<SignInPage />);

    const input = screen.getByPlaceholderText(/email address/i);
    fireEvent.change(input, { target: { value: "u@example.com" } });

    const submit = screen.getByRole("button", { name: /continue with email/i });
    await act(async () => {
      fireEvent.click(submit);
    });

    expect(signInStub.emailCode.sendCode).toHaveBeenCalledWith({
      emailAddress: "u@example.com",
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /verification/i })
      ).toBeInTheDocument();
    });
  });

  it("redirects to /sign-in?errorCode=waitlist when sendCode returns waitlist error", async () => {
    signInStub.emailCode.sendCode.mockResolvedValue({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });
    render(<SignInPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in?errorCode=waitlist");
    });
  });

  it("redirects to account_not_found when the submitted email has no account", async () => {
    signInStub.emailCode.sendCode.mockResolvedValue({
      error: {
        code: "form_identifier_not_found",
        message: "No account found",
      },
    });
    render(<SignInPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "unknown@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in?errorCode=account_not_found");
    });
  });
});

describe("sign-in — OTP verify", () => {
  it("calls verifyCode + finalize on a 6-digit code", async () => {
    render(<SignInPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /verification/i })
      ).toBeInTheDocument()
    );

    signInStub.status = "complete";

    // OTP input renders a hidden input — type into it via fireEvent
    const otpInput = document.querySelector(
      'input[data-input-otp="true"], input[autocomplete="one-time-code"]'
    ) as HTMLInputElement | null;
    expect(otpInput).not.toBeNull();
    if (!otpInput) {
      return;
    }

    await act(async () => {
      fireEvent.change(otpInput, { target: { value: "123456" } });
    });

    await waitFor(() => {
      expect(signInStub.emailCode.verifyCode).toHaveBeenCalledWith({
        code: "123456",
      });
    });
    await waitFor(() => {
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });
});

describe("sign-in — OAuth", () => {
  it("forwards GitHub strategy to signIn.sso with Future API redirect shape", async () => {
    render(<SignInPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with github/i })
      );
    });

    expect(signInStub.sso).toHaveBeenCalledWith({
      strategy: "oauth_github",
      redirectCallbackUrl: "/sso-callback",
      redirectUrl: "/",
    });
  });

  it("redirects to /sign-in?errorCode=waitlist when sso returns waitlist error", async () => {
    signInStub.sso.mockResolvedValue({
      error: { code: "sign_up_restricted_waitlist", message: "waitlist" },
    });
    render(<SignInPage />);

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with github/i })
      );
    });

    await waitFor(() => {
      expect(hrefValue).toBe("/sign-in?errorCode=waitlist");
    });
  });
});

describe("sign-in — error banner", () => {
  it("renders ErrorBanner when ?errorCode=waitlist is present", () => {
    searchParamsValue = new URLSearchParams("errorCode=waitlist");
    render(<SignInPage />);
    expect(
      screen.getByText(/sign-ups are currently unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /join the waitlist/i })
    ).toBeInTheDocument();
  });

  it("renders the waitlist CTA when ?errorCode=account_not_found is present", () => {
    searchParamsValue = new URLSearchParams("errorCode=account_not_found");
    render(<SignInPage />);
    expect(
      screen.getByText(/couldn't find a lightfast account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /join the waitlist/i })
    ).toHaveAttribute("href", "/early-access");
  });
});
