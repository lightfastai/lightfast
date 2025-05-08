import { RootLayout } from "@/components/root-layout";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const RootRoute = createRootRoute({
  component: Root,
  notFoundComponent: () => (
    <RootLayout>
      <div className="flex h-full flex-col items-center justify-center">
        <h1 className="text-2xl font-bold">Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
      </div>
    </RootLayout>
  ),
});

export const ComposerRootRoute = createRootRoute({
  component: ComposerRoot,
});

function Root() {
  return <Outlet />;
}

function ComposerRoot() {
  return <Outlet />;
}
