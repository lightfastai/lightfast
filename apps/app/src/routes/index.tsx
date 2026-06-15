import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
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
            color: "#a1a1aa",
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          app.lightfast
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(2.25rem, 7vw, 4.5rem)",
            lineHeight: 0.95,
          }}
        >
          Lightfast Console TanStack
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "34rem",
            color: "#d4d4d8",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          Canonical Lightfast console running on TanStack Start.
        </p>
      </section>
    </main>
  );
}
