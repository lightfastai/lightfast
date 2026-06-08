import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useTRPC } from "../../trpc/react";
import { useAuthSnapshot } from "../../use-auth-snapshot";

const sectionClass = "mb-4 max-w-none";
const cardClass =
  "mb-4 flex flex-col overflow-hidden rounded-lg border border-[#0d0d0d]/10 bg-[#0d0d0d]/4 [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-white/3";
const rowClass =
  "flex items-center justify-between gap-4 border-b border-[#0d0d0d]/5 px-4 py-3 last:border-b-0 [.electron-dark_&]:border-white/5";
const labelClass = "text-[12px] text-[#0d0d0d] [.electron-dark_&]:text-white";
const buttonClass =
  "inline-flex cursor-default items-center gap-1.5 rounded-md border border-[#0d0d0d]/10 bg-[#0d0d0d]/4 px-2.5 py-1 text-[12px] text-[#0d0d0d] [-webkit-app-region:no-drag] [.electron-dark_&]:border-white/10 [.electron-dark_&]:bg-white/3 [.electron-dark_&]:text-white";

export function Account() {
  const auth = useAuthSnapshot();
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.viewer.account.get.queryOptions(),
    enabled: auth.isSignedIn,
  });
  const data = query.data;

  if (!auth.isSignedIn) {
    return (
      <section className={sectionClass}>
        <div className={cardClass}>
          <div className={rowClass}>
            <div className={labelClass}>Not signed in</div>
            <button
              className={buttonClass}
              onClick={() => void window.lightfastBridge.auth.signIn()}
              type="button"
            >
              Sign in
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <div className={cardClass}>
        <div className={rowClass}>
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className={cn(
                "size-10 flex-shrink-0 rounded-full bg-[#0d0d0d]/4 bg-center bg-cover [.electron-dark_&]:bg-white/3",
                data?.imageUrl
                  ? undefined
                  : "bg-[#0d0d0d]/10 [.electron-dark_&]:bg-white/7"
              )}
              style={
                data?.imageUrl
                  ? { backgroundImage: `url("${data.imageUrl}")` }
                  : undefined
              }
            />
            <div>
              <div className="font-medium text-[#0d0d0d] text-[12px] [.electron-dark_&]:text-white">
                {data?.fullName ?? "—"}
              </div>
              <div className="text-[#0d0d0d]/50 text-[12px] [.electron-dark_&]:text-white/50">
                {data?.primaryEmailAddress ?? ""}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <div className={rowClass}>
          <div className={labelClass}>Sign out of Lightfast</div>
          <button
            className={cn(buttonClass, "text-red-500 hover:bg-red-500/8")}
            onClick={() => void window.lightfastBridge.auth.signOut()}
            type="button"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </section>
  );
}
