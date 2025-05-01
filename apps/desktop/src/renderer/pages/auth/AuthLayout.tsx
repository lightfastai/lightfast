import { Link, Outlet } from "@tanstack/react-router";

class Metadata {}

export const metadata: Metadata = {
  title: "Authentication",
  description: "Authentication forms built using the components.",
};

export const AuthLayout = () => {
  return (
    <>
      <main>
        <div className="mx-auto flex h-screen w-full max-w-lg flex-col justify-center gap-6">
          <div className="flex flex-row">
            <div className="z-[1500] mx-auto flex flex-col items-center">
              <div>
                <div className="from-background/20 to-background/80 border-muted/80 shadow-3xl flex flex-col justify-center gap-6 rounded border bg-gradient-to-b p-6 shadow backdrop-blur-xs">
                  <span className="align-center animate-fadeIn border-muted/40 to-border-muted/40 absolute top-0 mx-auto flex h-[1px] w-full flex-grow flex-col items-center rounded bg-gradient-to-r via-[#A9CEC0]/30 text-center opacity-0"></span>
                  <div className="flex flex-col">
                    <Outlet />
                  </div>
                  <div className="text-muted-foreground mt-4 px-6 text-center text-sm">
                    By continuing, you agree to our{" "}
                    <Link
                      to="https://example.com/legal/terms-of-service"
                      className="hover:text-accent-foreground underline underline-offset-4"
                    >
                      Terms & Conditions
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="https://example.com/legal/privacy-policy"
                      className="hover:text-accent-foreground underline underline-offset-4"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
