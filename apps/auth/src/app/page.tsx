import Image from "next/image";

import { auth } from "@vendor/openauth/server";

import { login, logout } from "./actions";

export default async function Home() {
  const userSession = await auth();
  console.log("session", userSession);
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
            </>
          ) : (
            <>
              <li>Login with your email and password.</li>
              <li>
                And then check out <code>app/page.tsx</code>.
              </li>
            </>
          )}
        </ol>

        <div className="ctas">
          {userSession ? (
            <form action={logout}>
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
