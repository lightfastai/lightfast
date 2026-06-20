"use client";

import { captureException } from "@sentry/browser";
import type NextError from "next/error";
import { useEffect } from "react";

interface GlobalErrorProperties {
  readonly error: NextError & { digest?: string };
  readonly reset: () => void;
}

const GlobalError = ({ error, reset }: GlobalErrorProperties) => {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head />
      <body
        style={{
          alignItems: "center",
          background: "#09090b",
          boxSizing: "border-box",
          color: "#fafafa",
          display: "flex",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "32px",
        }}
      >
        <main
          style={{
            maxWidth: "440px",
            textAlign: "center",
            width: "100%",
          }}
        >
          <p
            style={{
              color: "#a1a1aa",
              fontSize: "14px",
              letterSpacing: "0",
              lineHeight: "20px",
              margin: "0 0 16px",
            }}
          >
            500
          </p>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "0",
              lineHeight: "40px",
              margin: "0 0 12px",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "#d4d4d8",
              fontSize: "16px",
              letterSpacing: "0",
              lineHeight: "24px",
              margin: "0 0 24px",
            }}
          >
            Sorry, something went wrong on our end.
          </p>
          {error.digest ? (
            <p
              style={{
                color: "#71717a",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: "12px",
                letterSpacing: "0",
                lineHeight: "18px",
                margin: "0 0 24px",
                overflowWrap: "anywhere",
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                appearance: "none",
                background: "#fafafa",
                border: "1px solid #fafafa",
                borderRadius: "6px",
                color: "#09090b",
                cursor: "pointer",
                font: "inherit",
                fontSize: "14px",
                fontWeight: 500,
                height: "36px",
                letterSpacing: "0",
                lineHeight: "20px",
                padding: "0 14px",
              }}
              type="button"
            >
              Try again
            </button>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                appearance: "none",
                background: "transparent",
                border: "1px solid #3f3f46",
                borderRadius: "6px",
                color: "#fafafa",
                cursor: "pointer",
                font: "inherit",
                fontSize: "14px",
                fontWeight: 500,
                height: "36px",
                letterSpacing: "0",
                lineHeight: "20px",
                padding: "0 14px",
              }}
              type="button"
            >
              Return home
            </button>
          </div>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
