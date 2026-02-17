"use client";

import {
  useCallback,
  useMemo,
  useState,
  startTransition
  
} from "react";
import type {ReactNode} from "react";
import { PrefetchCrossZoneLinksContext } from "@vercel/microfrontends/next/client";

/**
 * Drop-in replacement for PrefetchCrossZoneLinksProvider that always renders
 * a Context.Provider on both server and client.
 *
 * The upstream implementation conditionally renders <Fragment> on the server
 * (and Chrome) vs <Context.Provider> on Safari/Firefox. This changes the React
 * fiber tree depth, causing every useId() value inside children to differ
 * between SSR and hydration — which breaks Radix UI components.
 *
 * @see https://github.com/vercel/microfrontends — upstream bug
 */
export function StablePrefetchCrossZoneLinksProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [hrefs, setHrefs] = useState<Set<string>>(new Set());

  const prefetchHref = useCallback((href: string) => {
    startTransition(() => {
      setHrefs((prev) => (prev.has(href) ? prev : new Set(prev).add(href)));
    });
  }, []);

  const value = useMemo(() => ({ prefetchHref }), [prefetchHref]);

  return (
    <PrefetchCrossZoneLinksContext.Provider value={value}>
      {children}
      {[...hrefs].map((href) => (
        <link key={href} as="fetch" href={href} rel="preload" />
      ))}
    </PrefetchCrossZoneLinksContext.Provider>
  );
}
