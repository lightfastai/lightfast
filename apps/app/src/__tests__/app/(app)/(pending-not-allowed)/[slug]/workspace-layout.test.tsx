import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sidebarProviderSpy = vi.fn();
const appSidebarSpy = vi.fn();
const authenticatedTopbarSpy = vi.fn();
const commandMenuSpy = vi.fn();
const isDeveloperConnectionsEnabledMock = vi.fn();

vi.mock("@repo/ui/components/ui/sidebar", () => ({
  SidebarProvider: (props: { children: ReactNode }) => {
    sidebarProviderSpy(props);
    return <div data-testid="sidebar-provider">{props.children}</div>;
  },
  SidebarInset: (props: { children: ReactNode }) => (
    <div data-testid="sidebar-inset">{props.children}</div>
  ),
  SidebarTrigger: () => <button type="button">trigger</button>,
}));

vi.mock("~/components/app-sidebar", () => ({
  AppSidebar: (props: { developerConnectionsEnabled?: boolean }) => {
    appSidebarSpy(props);
    return <div data-testid="app-sidebar" />;
  },
}));

vi.mock("@api/app/feature-flags", () => ({
  isDeveloperConnectionsEnabled: () => isDeveloperConnectionsEnabledMock(),
}));

vi.mock("~/components/authenticated-topbar", () => ({
  AuthenticatedTopbar: (props: { actions?: ReactNode; left?: ReactNode }) => {
    authenticatedTopbarSpy(props);
    return (
      <div data-testid="authenticated-topbar">
        {props.actions}
        {props.left}
      </div>
    );
  },
}));

vi.mock("~/components/workspace-command-menu", () => ({
  WorkspaceCommandMenu: (props: { children: ReactNode }) => {
    commandMenuSpy(props);
    return <div data-testid="command-menu">{props.children}</div>;
  },
}));

import WorkspaceLayout from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/layout";

beforeEach(() => {
  sidebarProviderSpy.mockClear();
  appSidebarSpy.mockClear();
  authenticatedTopbarSpy.mockClear();
  commandMenuSpy.mockClear();
  isDeveloperConnectionsEnabledMock.mockReset();
  isDeveloperConnectionsEnabledMock.mockResolvedValue(false);
});

async function renderWorkspaceLayout({
  actions,
  children,
}: {
  actions: ReactNode;
  children: ReactNode;
}) {
  const element = await WorkspaceLayout({ actions, children });
  render(element);
}

describe("WorkspaceLayout", () => {
  it("wraps content with sidebar chrome and authenticated topbar", async () => {
    await renderWorkspaceLayout({
      actions: null,
      children: <div>workspace content</div>,
    });

    expect(sidebarProviderSpy).toHaveBeenCalledTimes(1);
    expect(appSidebarSpy).toHaveBeenCalledTimes(1);
    expect(authenticatedTopbarSpy).toHaveBeenCalledTimes(1);
    expect(commandMenuSpy).toHaveBeenCalledTimes(1);
  });

  it("passes the sidebar trigger into the topbar left slot", async () => {
    await renderWorkspaceLayout({
      actions: null,
      children: <div>workspace content</div>,
    });

    const topbarProps = authenticatedTopbarSpy.mock.calls[0]?.[0];
    expect(topbarProps?.left).toBeTruthy();
  });

  it("forwards the actions slot into the topbar", async () => {
    await renderWorkspaceLayout({
      actions: <div>view switcher</div>,
      children: <div>workspace content</div>,
    });

    const topbarProps = authenticatedTopbarSpy.mock.calls[0]?.[0];
    expect(topbarProps?.actions).toBeTruthy();
  });

  it("renders children inside the command menu", async () => {
    await renderWorkspaceLayout({
      actions: null,
      children: <div>workspace content</div>,
    });

    const commandMenuProps = commandMenuSpy.mock.calls[0]?.[0];
    expect(commandMenuProps?.children).toBeTruthy();
    expect(commandMenuProps).toBeTruthy();
  });

  it("passes the developer connections flag state to the sidebar", async () => {
    isDeveloperConnectionsEnabledMock.mockResolvedValue(true);

    await renderWorkspaceLayout({
      actions: null,
      children: <div>workspace content</div>,
    });

    expect(isDeveloperConnectionsEnabledMock).toHaveBeenCalledOnce();
    expect(appSidebarSpy).toHaveBeenCalledWith({
      developerConnectionsEnabled: true,
    });
  });
});
