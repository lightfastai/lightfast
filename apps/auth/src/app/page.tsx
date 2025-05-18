import Image from "next/image";
import { redirect } from "next/navigation";

import {
  getSessionFromCookiesNextHandler,
  login,
  logout,
} from "@vendor/openauth/server";

export default async function Home() {
  const userSession = await getSessionFromCookiesNextHandler();
  return (
    <div className="page">
      <main className="main">
        <Image
          className="logo"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol>
          {userSession ? (
            <>
              <li>
                Logged in as <code>{userSession.user.id}</code>.
              </li>
              <li>
                And then check out <code>app/page.tsx</code>.
              </li>
          ) : (
                And then check out <code>app/page.tsx</code>.
              </li>
            </>
          )}
        </ol>

        <div className="ctas">
          {userSession ? (
            <form
              action={async () => {
                "use server";
                await logout();
                redirect("/");
              }}
            >
              <button className="secondary">Logout</button>
            </form>
          ) : (
            <form action={login}>
              <button className="primary">Login with OpenAuth</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
