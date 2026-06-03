import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { clientEnv } from "~/env/client";

const getGreeting = createServerFn({ method: "GET" }).handler(async () => {
  const { getServerEnv } = await import("~/env/server");
  const serverEnv = getServerEnv();

  return {
    message: "Hello from TanStack Start.",
    generatedAt: new Date().toISOString(),
    publicAppUrl: clientEnv.VITE_LIGHTFAST_APP_URL,
    publicExampleUrl: clientEnv.VITE_TANSTACK_EXAMPLE_URL,
    serverRuntime: serverEnv.NODE_ENV,
    serviceSecretAvailable: serverEnv.SERVICE_JWT_SECRET.length >= 32,
  };
});

export const Route = createFileRoute("/")({
  loader: () => getGreeting(),
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        color: "#171717",
        background: "#f7f7f5",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 42rem)",
          display: "grid",
          gap: "1rem",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#6b7280",
            fontSize: "0.875rem",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          Lightfast
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 6vw, 4rem)",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          TanStack Start example
        </h1>
        <p
          style={{
            margin: 0,
            color: "#374151",
            fontSize: "1.125rem",
            lineHeight: 1.6,
          }}
        >
          {data.message}
        </p>
        <code
          style={{
            width: "fit-content",
            padding: "0.5rem 0.75rem",
            color: "#064e3b",
            background: "#d1fae5",
            border: "1px solid #a7f3d0",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          Server loader timestamp: {data.generatedAt}
        </code>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            gap: "0.5rem 1rem",
            margin: 0,
            color: "#374151",
            fontSize: "0.95rem",
            lineHeight: 1.5,
          }}
        >
          <dt style={{ color: "#6b7280", fontWeight: 600 }}>Public app URL</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
            {data.publicAppUrl}
          </dd>
          <dt style={{ color: "#6b7280", fontWeight: 600 }}>Example URL</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
            {data.publicExampleUrl}
          </dd>
          <dt style={{ color: "#6b7280", fontWeight: 600 }}>Server runtime</dt>
          <dd style={{ margin: 0 }}>{data.serverRuntime}</dd>
          <dt style={{ color: "#6b7280", fontWeight: 600 }}>Secret loaded</dt>
          <dd style={{ margin: 0 }}>
            {data.serviceSecretAvailable ? "yes" : "no"}
          </dd>
        </dl>
      </section>
    </main>
  );
}
