import type { FC, JSX } from "react";
import type { Manifest } from "vite";

import { ensureTrailingSlash } from "../utils/path";

type Options = {
  manifest?: Manifest;
  prod?: boolean;
} & JSX.IntrinsicElements["link"];

export const Link: FC<Options> = (options) => {
  let { href, prod, manifest, ...rest } = options;
  if (href) {
    if (prod ?? import.meta.env.PROD) {
      if (!manifest) {
        const MANIFEST = import.meta.glob<{ default: Manifest }>(
          "/dist/.vite/manifest.json",
          {
            eager: true,
          },
        );
        for (const [, manifestFile] of Object.entries(MANIFEST)) {
          if (manifestFile["default"]) {
            manifest = manifestFile["default"];
            break;
          }
        }
      }
      if (manifest) {
        const assetInManifest = manifest[href.replace(/^\//, "")];
        if (assetInManifest) {
          if (href.startsWith("/")) {
            return (
              <link
                href={`${ensureTrailingSlash(import.meta.env.BASE_URL)}${assetInManifest.file}`}
                {...rest}
              ></link>
            );
          }

          return <link href={assetInManifest.file} {...rest}></link>;
        }
      }
      return <></>;
    } else {
      return <link href={href} {...rest}></link>;
    }
  }

  return <link {...rest} />;
};
