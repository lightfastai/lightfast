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
  status: "missing_requirements" | "complete";
  verifications: {
    sendEmailCode: Mock;
    verifyEmailCode: Mock;
  };
}

let signUpStub: SignUpStub;
let searchParamsValue: URLSearchParams;

function makeSignUpStub(): SignUpStub {
  return {
    status: "missing_requirements",
    emailAddress: null,
    create: vi.fn().mockResolvedValue({ error: null }),
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
  useSignUp: () => ({ signUp: signUpStub }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

// MicrofrontendLink uses an env probe we don't need in tests; replace with a
// plain anchor.
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
  searchParamsValue = new URLSearchParams();
  hrefValue = "";
});

afterEach(() => {
  vi.clearAllMocks();
});

const { default: SignUpPage } = await import("~/app/(auth)/sign-up/page");

function checkLegalAccepted() {
  const checkbox = screen.getByRole("checkbox", {
    name: /accept the terms of service/i,
  });
  fireEvent.click(checkbox);
}

describe("sign-up — legal acceptance gate", () => {
  it("blocks email submit when checkbox is unchecked", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "u@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    expect(signUpStub.create).not.toHaveBeenCalled();
    expect(
      screen.getByText(/you must accept the terms of service/i)
    ).toBeInTheDocument();
  });

  it("does not render social or test-provider sign-up buttons", () => {
    render(<SignUpPage />);

    expect(
      screen.queryByRole("button", { name: /continue with github/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with test idp/i })
    ).not.toBeInTheDocument();
  });
});

describe("sign-up — email submit", () => {
  it("calls signUp.create + sendEmailCode and transitions to OTP view", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "u@example.com" },
    });
    checkLegalAccepted();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    expect(signUpStub.create).toHaveBeenCalledWith({
      emailAddress: "u@example.com",
      legalAccepted: true,
    });
    expect(signUpStub.verifications.sendEmailCode).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /verify your email/i })
      ).toBeInTheDocument();
    });
  });

  it("short-circuits and finalizes when create returns status=complete (invitation auto-session)", async () => {
    signUpStub.status = "complete";
    render(<SignUpPage />);

    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: "u@example.com" },
    });
    checkLegalAccepted();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /continue with email/i })
      );
    });

    await waitFor(() => {
      expect(signUpStub.finalize).toHaveBeenCalled();
    });
    expect(signUpStub.verifications.sendEmailCode).not.toHaveBeenCalled();
    expect(hrefValue).toBe("/");
  });
});

describe("sign-up — captcha mount", () => {
  it("renders <div id='clerk-captcha' /> for bot protection", () => {
    render(<SignUpPage />);
    expect(document.getElementById("clerk-captcha")).not.toBeNull();
  });
});

describe("sign-up — error banner", () => {
  it("renders ErrorBanner when ?errorCode=waitlist is present", () => {
    searchParamsValue = new URLSearchParams("errorCode=waitlist");
    render(<SignUpPage />);
    expect(
      screen.getByText(/sign-ups are currently unavailable/i)
    ).toBeInTheDocument();
  });
});
