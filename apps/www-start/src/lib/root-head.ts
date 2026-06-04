export function buildRootHead(stylesheetHref?: string) {
  return {
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Lightfast - The Operating Layer for Agents and Apps" },
      {
        name: "description",
        content:
          "Lightfast is the operating layer between your agents and apps.",
      },
      {
        name: "theme-color",
        content: "#09090b",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: "Lightfast",
      },
      {
        property: "og:title",
        content: "Lightfast - The Operating Layer for Agents and Apps",
      },
      {
        property: "og:description",
        content:
          "Lightfast is the operating layer between your agents and apps.",
      },
      {
        property: "og:url",
        content: "https://lightfast.ai",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: "Lightfast - The Operating Layer for Agents and Apps",
      },
      {
        name: "twitter:description",
        content:
          "Lightfast is the operating layer between your agents and apps.",
      },
    ],
    links: [
      ...(stylesheetHref
        ? [
            {
              rel: "stylesheet",
              href: stylesheetHref,
            },
          ]
        : []),
      {
        rel: "canonical",
        href: "https://lightfast.ai",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
  };
}
