import { render, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

interface SignUpFutureStub {
  missingFields: string[] | null;
  status: "missing_requirements" | "complete" | null;
  verifications: {
    externalAccount: { status: string } | null;
  };
}

interface LegacySignUpStub {
  update: Mock;
}

interface ClerkStub {
  client: { signUp: LegacySignUpStub };
  setActive: Mock;
}

let futureSignUp: SignUpFutureStub | null;
let clerkStub: ClerkStub;

function makeFutureSignUp(
  overrides: Partial<SignUpFutureStub> = {}
): SignUpFutureStub {
  return {
    status: "missing_requirements",
    missingFields: ["legal_accepted"],
    verifications: { externalAccount: { status: "verified" } },
    ...overrides,
  };
}

function makeClerkStub(
  updateResolved: { status: string; createdSessionId?: string } = {
    status: "complete",
    createdSessionId: "sess_test_recon",
  }
): ClerkStub {
  return {
    client: {
      signUp: {
        update: vi.fn().mockResolvedValue(updateResolved),
      },
    },
    setActive: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.resetModules();
  futureSignUp = makeFutureSignUp();
  clerkStub = makeClerkStub();

  vi.doMock("@vendor/clerk/client", () => ({
    useSignUp: () => ({ signUp: futureSignUp }),
    useClerk: () => clerkStub,
  }));

  // Stub window.location to capture navigations
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      href: "https://app.lightfast.localhost/sign-up",
      replace: vi.fn(),
      assign: vi.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  vi.doUnmock("@vendor/clerk/client");
});

describe("SignUpReconciler", () => {
  it("applies legalAccepted via legacy update + setActive + redirects when conditions match", async () => {
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);

    await waitFor(() => {
      expect(clerkStub.client.signUp.update).toHaveBeenCalledWith({
        legalAccepted: true,
      });
    });

    await waitFor(() => {
      expect(clerkStub.setActive).toHaveBeenCalledWith({
        session: "sess_test_recon",
      });
    });

    await waitFor(() => {
      expect(window.location.href).toBe("/account/welcome");
    });
  });

  it("does not call update when signUp is null", async () => {
    futureSignUp = null;
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);
    // Give effects a chance to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.client.signUp.update).not.toHaveBeenCalled();
  });

  it("does not call update when status !== missing_requirements", async () => {
    futureSignUp = makeFutureSignUp({ status: "complete" });
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.client.signUp.update).not.toHaveBeenCalled();
  });

  it("does not call update when missingFields !== ['legal_accepted']", async () => {
    futureSignUp = makeFutureSignUp({
      missingFields: ["legal_accepted", "email_address"],
    });
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.client.signUp.update).not.toHaveBeenCalled();
  });

  it("does not call update when externalAccount.status !== verified", async () => {
    futureSignUp = makeFutureSignUp({
      verifications: { externalAccount: { status: "unverified" } },
    });
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.client.signUp.update).not.toHaveBeenCalled();
  });

  it("does not redirect when update resolves but status is not complete", async () => {
    clerkStub = makeClerkStub({ status: "missing_requirements" });
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    render(<SignUpReconciler />);
    await waitFor(() => {
      expect(clerkStub.client.signUp.update).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.setActive).not.toHaveBeenCalled();
    expect(window.location.href).toBe(
      "https://app.lightfast.localhost/sign-up"
    );
  });

  it("calls update only once even if effect fires multiple times (strict mode + re-renders)", async () => {
    const { SignUpReconciler } = await import(
      "~/app/(auth)/_components/sign-up-reconciler"
    );
    const { rerender } = render(<SignUpReconciler />);
    await waitFor(() => {
      expect(clerkStub.client.signUp.update).toHaveBeenCalledTimes(1);
    });
    rerender(<SignUpReconciler />);
    rerender(<SignUpReconciler />);
    await new Promise((r) => setTimeout(r, 10));
    expect(clerkStub.client.signUp.update).toHaveBeenCalledTimes(1);
  });
});
