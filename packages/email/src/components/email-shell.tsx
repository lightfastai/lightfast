import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Tailwind,
} from "@react-email/components";
import type { ReactNode } from "react";

const LIGHTFAST_ASSET_BASE_URL = "https://lightfast.ai";

const lightfastSupportingFontFaces = `
@font-face {
  font-family: "Geist Mono Variable";
  font-style: normal;
  font-weight: 100 900;
  mso-font-alt: "Courier New";
  src: url("${LIGHTFAST_ASSET_BASE_URL}/fonts/geist/GeistMono-Variable.woff2") format("woff2");
}

@font-face {
  font-family: "PP Neue Montreal";
  font-style: normal;
  font-weight: 400;
  mso-font-alt: "Arial";
  src: url("${LIGHTFAST_ASSET_BASE_URL}/fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2") format("woff2");
}

@font-face {
  font-family: "PP Neue Montreal";
  font-style: normal;
  font-weight: 500;
  mso-font-alt: "Arial";
  src: url("${LIGHTFAST_ASSET_BASE_URL}/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2") format("woff2");
}

`;

interface EmailShellProps {
  children: ReactNode;
  preview: string;
}

export function EmailShell({ children, preview }: EmailShellProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fallbackFontFamily={["Arial", "sans-serif"]}
          fontFamily="Geist Variable"
          fontStyle="normal"
          fontWeight="100 900"
          webFont={{
            format: "woff2",
            url: `${LIGHTFAST_ASSET_BASE_URL}/fonts/geist/Geist-Variable.woff2`,
          }}
        />
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static font-face CSS for React Email head output
          dangerouslySetInnerHTML={{ __html: lightfastSupportingFontFaces }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                background: "#FFFFFF",
                border: "#0D0D0D1A",
                card: "#FFFFFF",
                foreground: "#282828",
                muted: "#F3F3F3",
                "muted-foreground": "#5D5D5D",
                primary: "#181818",
                "primary-foreground": "#FFFFFF",
              },
              fontFamily: {
                sans: [
                  "Geist Variable",
                  "Geist",
                  "ui-sans-serif",
                  "system-ui",
                  "-apple-system",
                  "BlinkMacSystemFont",
                  "Segoe UI",
                  "sans-serif",
                ],
                title: [
                  "PP Neue Montreal",
                  "Geist Variable",
                  "Geist",
                  "ui-sans-serif",
                  "system-ui",
                  "sans-serif",
                ],
                mono: [
                  "Geist Mono Variable",
                  "Geist Mono",
                  "SF Mono",
                  "ui-monospace",
                  "Menlo",
                  "monospace",
                ],
              },
            },
          },
        }}
      >
        <Body className="m-0 bg-muted p-0 font-sans text-foreground">
          <Container className="mx-auto my-0 max-w-[720px] px-[68px] py-14">
            {children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
