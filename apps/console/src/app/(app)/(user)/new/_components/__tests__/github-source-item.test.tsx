import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { Accordion } from "@repo/ui/components/ui/accordion";
import { GitHubSourceItem } from "../github-source-item";

// ── Hoisted mocks (accessible in vi.mock factories) ──────────────────────────

const {
  mockInstallation,
  mockWorkspaceForm,
  mockHandleConnect,
  mockOpenCustomUrl,
  mockUseOAuthPopup,
  GITHUB_LIST_KEY,
} = vi.hoisted(() => {
  const mockInstallation = {
    id: "inst-1",
    gwInstallationId: "gw-inst-1",
    accountLogin: "test-org",
    accountType: "Organization",
    avatarUrl: "https://github.com/test-org.png",
  };

  const GITHUB_LIST_KEY = [
    ["connections", "github", "list"],
    { type: "query" },
  ];

  const mockHandleConnect = vi.fn();
  const mockOpenCustomUrl = vi.fn();
  const mockUseOAuthPopup = vi.fn(() => ({
    handleConnect: mockHandleConnect,
    openCustomUrl: mockOpenCustomUrl,
  }));

  const mockWorkspaceForm = {
    gwInstallationId: "gw-inst-1" as string | null,
    setGwInstallationId: vi.fn(),
    installations: [mockInstallation] as (typeof mockInstallation)[],
    setInstallations: vi.fn(),
    selectedInstallation: mockInstallation as typeof mockInstallation | null,
    setSelectedInstallation: vi.fn(),
    selectedRepositories: [] as { id: number; name: string }[],
    setSelectedRepositories: vi.fn(),
    toggleRepository: vi.fn(),
  };

  return {
    mockInstallation,
    mockWorkspaceForm,
    mockHandleConnect,
    mockOpenCustomUrl,
    mockUseOAuthPopup,
    GITHUB_LIST_KEY,
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../workspace-form-provider", () => ({
  useWorkspaceForm: () => mockWorkspaceForm,
}));

vi.mock("~/hooks/use-oauth-popup", () => ({
  useOAuthPopup: mockUseOAuthPopup,
}));

vi.mock("@repo/console-trpc/react", () => ({
  useTRPC: () => ({
    connections: {
      github: {
        list: {
          queryOptions: () => ({
            queryKey: GITHUB_LIST_KEY,
            queryFn: () => Promise.resolve(null),
          }),
        },
        repositories: {
          queryOptions: (input: Record<string, string>) => ({
            queryKey: [
              ["connections", "github", "repositories"],
              { input, type: "query" },
            ],
            queryFn: () => Promise.resolve([]),
          }),
        },
      },
    },
  }),
}));

// ── Test fixtures ────────────────────────────────────────────────────────────

const MOCK_CONNECTION = {
  id: "conn-1",
  installations: [mockInstallation],
};

const MOCK_REPO = {
  id: 123,
  name: "my-repo",
  description: "A test repository",
  isPrivate: false,
};

const MOCK_PRIVATE_REPO = {
  id: 456,
  name: "secret-repo",
  description: "A private repository",
  isPrivate: true,
};

const GITHUB_REPOS_KEY = [
  ["connections", "github", "repositories"],
  {
    input: { integrationId: "gw-inst-1", installationId: "inst-1" },
    type: "query",
  },
];

// ── Render helper ────────────────────────────────────────────────────────────

function renderComponent(options?: {
  connectionData?: unknown;
  reposData?: typeof MOCK_REPO[];
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Pre-seed cache so useSuspenseQuery resolves synchronously
  queryClient.setQueryData(
    GITHUB_LIST_KEY,
    options?.connectionData === undefined
      ? MOCK_CONNECTION
      : options.connectionData,
  );

  // Pre-seed repos cache to avoid async loading
  if (options?.reposData) {
    queryClient.setQueryData(GITHUB_REPOS_KEY, options.reposData);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>
        <Accordion type="single" defaultValue="github">
          <GitHubSourceItem />
        </Accordion>
      </Suspense>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset workspace form to connected state
  mockWorkspaceForm.gwInstallationId = "gw-inst-1";
  mockWorkspaceForm.installations = [mockInstallation];
  mockWorkspaceForm.selectedInstallation = mockInstallation;
  mockWorkspaceForm.selectedRepositories = [];
});

describe("GitHubSourceItem", () => {
  // ── Connected state rendering ────────────────────────────────────────────

  describe("connected state rendering", () => {
    it("shows 'Connected' badge when installations exist", () => {
      renderComponent();
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("renders repository names and private labels", () => {
      renderComponent({ reposData: [MOCK_REPO, MOCK_PRIVATE_REPO] });
      expect(screen.getByText("my-repo")).toBeInTheDocument();
      expect(screen.getByText("secret-repo")).toBeInTheDocument();
      expect(screen.getByText("Private")).toBeInTheDocument();
    });

    it("shows adjust permissions link", () => {
      renderComponent();
      expect(
        screen.getByText(/Adjust GitHub App permissions/),
      ).toBeInTheDocument();
    });
  });

  // ── Disconnected state rendering ─────────────────────────────────────────

  describe("disconnected state rendering", () => {
    beforeEach(() => {
      mockWorkspaceForm.gwInstallationId = null;
      mockWorkspaceForm.installations = [];
      mockWorkspaceForm.selectedInstallation = null;
    });

    it("shows 'Connect GitHub' button when no installations", () => {
      renderComponent({ connectionData: null });
      expect(
        screen.getByRole("button", { name: /Connect GitHub/i }),
      ).toBeInTheDocument();
    });

    it("shows 'Not connected' badge", () => {
      renderComponent({ connectionData: null });
      expect(screen.getByText("Not connected")).toBeInTheDocument();
    });
  });

  // ── handleAdjustPermissions URL builder (critical bug coverage) ──────────

  describe("handleAdjustPermissions URL builder", () => {
    it("passes buildUrl callback to openCustomUrl", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByText(/Adjust GitHub App permissions/));

      expect(mockOpenCustomUrl).toHaveBeenCalledOnce();
      const firstArg: unknown = mockOpenCustomUrl.mock.calls[0]?.[0];
      expect(typeof firstArg).toBe("function");
    });

    it("builds URL with correct app slug and state parameter", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(screen.getByText(/Adjust GitHub App permissions/));

      const buildUrl = mockOpenCustomUrl.mock.calls[0]?.[0] as (
        data: { url: string; state: string },
      ) => string;
      const url = buildUrl({
        url: "https://github.com/login/oauth/authorize?client_id=abc",
        state: "test-state-123",
      });

      expect(url).toBe(
        "https://github.com/apps/test-github-app/installations/select_target?state=test-state-123",
      );
    });
  });

  // ── Connect button interaction ───────────────────────────────────────────

  describe("connect button interaction", () => {
    beforeEach(() => {
      mockWorkspaceForm.gwInstallationId = null;
      mockWorkspaceForm.installations = [];
      mockWorkspaceForm.selectedInstallation = null;
    });

    it("calls handleConnect when clicked", async () => {
      const user = userEvent.setup();
      renderComponent({ connectionData: null });

      await user.click(
        screen.getByRole("button", { name: /Connect GitHub/i }),
      );

      expect(mockHandleConnect).toHaveBeenCalledOnce();
    });

    it("initializes useOAuthPopup with github provider", () => {
      renderComponent({ connectionData: null });

      expect(mockUseOAuthPopup).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "github" }),
      );
    });
  });

  // ── Repository selection ─────────────────────────────────────────────────

  describe("repository selection", () => {
    it("calls toggleRepository with the clicked repo", async () => {
      const user = userEvent.setup();
      renderComponent({ reposData: [MOCK_REPO] });

      await user.click(screen.getByText("my-repo"));

      expect(mockWorkspaceForm.toggleRepository).toHaveBeenCalledWith(
        MOCK_REPO,
      );
    });

    it("shows '1 selected' badge when a repository is selected", () => {
      mockWorkspaceForm.selectedRepositories = [MOCK_REPO];
      renderComponent();

      expect(screen.getByText("1 selected")).toBeInTheDocument();
    });
  });
});
