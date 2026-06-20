import { Link, Section, Text } from "@react-email/components";
import {
  DOT_MATRIX_PATH,
  WORDMARK_PATH,
  WORDMARK_VIEWBOX,
} from "@repo/ui-v2/components/brand/logo";

export interface EmailFooterProps {
  manageUrl: string;
  unsubscribeUrl?: string;
}

export function LightfastMark({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox="0 0 80 80"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={DOT_MATRIX_PATH} fill="#181818" />
    </svg>
  );
}

export function EmailFooter({
  manageUrl,
  unsubscribeUrl = manageUrl,
}: EmailFooterProps) {
  return (
    <Section className="mt-12">
      <LightfastLockup />
      <Text className="m-0 mt-4 text-muted-foreground text-sm leading-5">
        Questions or feedback? Drop us a line at hello@lightfast.ai
      </Text>
      <SocialLinks />
      <FooterLinks manageUrl={manageUrl} unsubscribeUrl={unsubscribeUrl} />
    </Section>
  );
}

function LightfastLockup() {
  const wordmarkHeight = 26;
  const wordmarkWidth = 117;

  return (
    <table
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          <td style={{ lineHeight: 0, padding: 0, verticalAlign: "middle" }}>
            <LightfastMark size={28} />
          </td>
          <td
            style={{
              lineHeight: 0,
              paddingLeft: "8px",
              verticalAlign: "middle",
            }}
          >
            <svg
              aria-label="Lightfast"
              focusable="false"
              height={wordmarkHeight}
              role="img"
              viewBox={WORDMARK_VIEWBOX}
              width={wordmarkWidth}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d={WORDMARK_PATH} fill="#181818" />
            </svg>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SocialLinks() {
  return (
    <table
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ borderCollapse: "collapse", marginTop: "16px" }}
    >
      <tbody>
        <tr>
          {socialLinks.map((social, index) => (
            <td
              key={social.label}
              style={{
                lineHeight: 0,
                padding: index === 0 ? 0 : "0 0 0 16px",
              }}
            >
              <Link
                aria-label={social.label}
                href={social.href}
                style={{
                  color: "#5D5D5D",
                  display: "inline-block",
                  height: "16px",
                  lineHeight: "16px",
                  textDecoration: "none",
                  width: "16px",
                }}
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  height="16"
                  viewBox={social.viewBox}
                  width="16"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d={social.path} fill="#5D5D5D" />
                </svg>
              </Link>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function FooterLinks({
  manageUrl,
  unsubscribeUrl,
}: {
  manageUrl: string;
  unsubscribeUrl: string;
}) {
  const links = [
    { href: unsubscribeUrl, label: "Unsubscribe" },
    { href: manageUrl, label: "Preferences" },
    { href: "https://lightfast.ai/v2/legal/privacy", label: "Privacy" },
  ];

  return (
    <table
      border={0}
      cellPadding="0"
      cellSpacing="0"
      role="presentation"
      style={{ borderCollapse: "collapse", marginTop: "16px" }}
    >
      <tbody>
        <tr>
          {links.map((link, index) => (
            <td
              key={link.label}
              style={{ padding: index === 0 ? 0 : "0 0 0 28px" }}
            >
              <Link
                className="text-muted-foreground text-sm leading-5 underline"
                href={link.href}
              >
                {link.label}
              </Link>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

const socialLinks = [
  {
    href: "https://x.com/lightfastai",
    label: "X",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.293 19.493h2.039L6.486 3.24H4.298l13.31 17.406Z",
    viewBox: "0 0 24 24",
  },
  {
    href: "https://github.com/lightfastai",
    label: "GitHub",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.236 1.84 1.236 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.467-2.38 1.235-3.22-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.045.138 3.003.404 2.29-1.552 3.296-1.23 3.296-1.23.653 1.653.242 2.873.12 3.176.77.84 1.233 1.91 1.233 3.22 0 4.61-2.806 5.625-5.48 5.92.43.372.823 1.102.823 2.222 0 1.605-.015 2.898-.015 3.293 0 .322.216.695.825.577C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    viewBox: "0 0 24 24",
  },
  {
    href: "https://www.linkedin.com/company/lightfastai",
    label: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.447-2.136 2.942v5.664H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.852 3.37-1.852 3.602 0 4.267 2.371 4.267 5.455v6.288ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.114 20.452H3.556V9h3.558v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z",
    viewBox: "0 0 24 24",
  },
  {
    href: "https://discord.gg/YqPDfcar2C",
    label: "Discord",
    path: "M20.317 4.369A19.8 19.8 0 0 0 15.364 2.8a13.8 13.8 0 0 0-.635 1.312 18.4 18.4 0 0 0-5.458 0A13 13 0 0 0 8.636 2.8 19.7 19.7 0 0 0 3.68 4.372C.533 9.046-.32 13.605.106 18.1a20 20 0 0 0 6.073 3.066 14.6 14.6 0 0 0 1.302-2.114 12.9 12.9 0 0 1-2.048-.985c.172-.126.34-.256.502-.39a14.2 14.2 0 0 0 12.13 0c.164.134.332.264.502.39-.65.386-1.338.717-2.05.986.375.738.813 1.444 1.303 2.113a20 20 0 0 0 6.075-3.067c.5-5.211-.855-9.729-3.578-13.73ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419s.955-2.418 2.157-2.418c1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419Zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419s.955-2.418 2.157-2.418c1.21 0 2.176 1.094 2.157 2.418 0 1.334-.947 2.419-2.157 2.419Z",
    viewBox: "0 0 24 24",
  },
] as const;
