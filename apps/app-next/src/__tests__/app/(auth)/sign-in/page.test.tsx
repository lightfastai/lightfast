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
  status: "needs_first_factor" | "complete";
}

let signInStub: SignInStub;
let searchParamsValue: URLSearchParams;
let userStub: { isLoaded: boolean; isSignedIn: boolean };

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
  };
}

vi.mock("@vendor/clerk", () => ({
  isClerkAPIResponseError: (err: unknown) =>
    typeof err === "object" && err !== null && "errors" in err,
  useSignIn: () => ({ signIn: signInStub }),
  useUser: () => userStub,
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
  userStub = { isLoaded: true, isSignedIn: false };
  hrefValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: SignInPage } = await import("~/app/(auth)/sign-in/page");

describe("sign-in — email submit", () => {
  it("continues already-signed-in users to a safe redirect target", async () => {
    const redirectUrl =
      "https://charmed-shark-52.accounts.dev/oauth-consent?client_id=cli";
    searchParamsValue = new URLSearchParams({
      redirect_url: redirectUrl,
    });
    userStub = { isLoaded: true, isSignedIn: true };

    render(<SignInPage />);

    await waitFor(() => {
      expect(hrefValue).toBe(redirectUrl);
    });
  });

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

  it("redirects to /sign-in?error=Authentication+failed when sendCode returns an unmapped error", async () => {
    signInStub.emailCode.sendCode.mockResolvedValue({
      error: {},
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
      expect(hrefValue).toBe("/sign-in?error=Authentication+failed");
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

  it("finalizes to a safe Clerk OAuth redirect URL", async () => {
    const redirectUrl =
      "https://charmed-shark-52.accounts.dev/oauth-consent?client_id=cli";
    searchParamsValue = new URLSearchParams({
      redirect_url: redirectUrl,
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

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /verification/i })
      ).toBeInTheDocument()
    );

    signInStub.status = "complete";
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
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe(redirectUrl);
  });

  it("falls back to root for unsafe external redirect URLs", async () => {
    searchParamsValue = new URLSearchParams({
      redirect_url: "https://evil.example/oauth-consent",
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

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /verification/i })
      ).toBeInTheDocument()
    );

    signInStub.status = "complete";
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
      expect(signInStub.finalize).toHaveBeenCalledTimes(1);
    });
    expect(hrefValue).toBe("/");
  });
});

describe("sign-in — email-only auth", () => {
  it("renders a form-local sign-up recovery link", () => {
    render(<SignInPage />);

    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^sign up$/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });

  it("does not render social or test-provider sign-in buttons", () => {
    render(<SignInPage />);

    expect(
      screen.queryByRole("button", { name: /continue with github/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with test idp/i })
    ).not.toBeInTheDocument();
  });
});

describe("sign-in — error banner", () => {
  it("ignores unknown errorCode values and renders the normal sign-in heading", () => {
    searchParamsValue = new URLSearchParams("errorCode=retired_code");
    render(<SignInPage />);
    expect(
      screen.getByRole("heading", { name: /log in to lightfast/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/sign-ups are currently unavailable/i)
    ).not.toBeInTheDocument();
  });

  it("renders a Sign up CTA when ?errorCode=account_not_found is present", () => {
    searchParamsValue = new URLSearchParams("errorCode=account_not_found");
    render(<SignInPage />);
    expect(
      screen.getByText(/couldn't find a lightfast account/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up/i })).toHaveAttribute(
      "href",
      "/sign-up"
    );
  });
});
