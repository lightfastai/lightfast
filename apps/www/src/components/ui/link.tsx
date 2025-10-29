"use client";

import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import * as React from "react";

type NextLinkProps = React.ComponentProps<typeof NextLink>;
type MicroLinkProps = React.ComponentProps<typeof MicrofrontendLink>;

type Props =
  | ({ microfrontend?: false } & NextLinkProps)
  | ({ microfrontend: true } & MicroLinkProps);

export function Link(props: Props) {
  if ("microfrontend" in props && props.microfrontend) {
    const { microfrontend: _mf, ...rest } = props as { microfrontend: true } & MicroLinkProps;
    return <MicrofrontendLink {...rest} />;
  }
  const { microfrontend: _mf, ...rest } = props as { microfrontend?: false } & NextLinkProps;
  return <NextLink {...rest} />;
}

export default Link;

