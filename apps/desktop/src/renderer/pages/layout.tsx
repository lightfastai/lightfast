import { Suspense } from "react";
import { signoutRoute } from "@/renderer/routes/routes";
import { useAuth } from "@clerk/clerk-react";
import { ExitIcon, ReloadIcon } from "@radix-ui/react-icons";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Outlet, useRouter } from "@tanstack/react-router";
import { ErrorBoundary } from "react-error-boundary";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";

export const PageLayout = () => {
  return (
    <>
      <main className="flex h-screen w-screen flex-grow flex-row overflow-hidden overscroll-none">
        <section className="flex h-full"></section>
        <section className="flex h-screen flex-grow flex-col">
          {/* <PageHeader /> */}
          <Suspense fallback={<span>Loading...</span>}>
            <div className="flex min-h-0 flex-grow flex-col">
              <Outlet />
            </div>
          </Suspense>
        </section>
      </main>
    </>
  );
};

export const App = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const fallbackSignoutAction = async () => {
    await router.navigate({ to: signoutRoute.fullPath });
  };

  return (
    <>
      <Suspense fallback={<span>Loading...</span>}>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={reset}
              fallbackRender={({ resetErrorBoundary }) => (
                <div className="flex h-screen w-full items-center justify-center">
                  <Alert
                    variant="destructive"
                    className="text-destructive-foreground w-full max-w-md items-center justify-center space-y-6 border-none"
                  >
                    <AlertTitle className="text-destructive-foreground justify-center text-center text-lg font-normal">
                      <h2 className="ggSmallCaps text-xl font-medium shadow-md">
                        Error
                      </h2>{" "}
                      <small>Something went wrong...</small>
                    </AlertTitle>
                    <AlertDescription className="flex flex-row items-center justify-center gap-4">
                      <div>
                        <Button
                          variant="default"
                          onClick={() => resetErrorBoundary()}
                        >
                          <ReloadIcon className="mr-2 h-4 w-4" /> Try again
                        </Button>
                      </div>
                      <div>
                        <Button
                          variant="ghost"
                          className="text-destructive-foreground"
                          onClick={async () => {
                            await signOut(fallbackSignoutAction);
                          }}
                        >
                          <ExitIcon className="mr-2 h-4 w-4" /> Log out
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            >
              <Outlet />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </Suspense>
    </>
  );
};
