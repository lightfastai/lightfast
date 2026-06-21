"use client";

import dynamic from "next/dynamic";
import { type Ref, useEffect, useRef, useState } from "react";

const FooterArcade = dynamic(
  () => import("@repo/space-invaders-react").then((mod) => mod.FooterArcade),
  {
    loading: () => <FooterArcadePlaceholder />,
    ssr: false,
  }
);

function FooterArcadePlaceholder({
  rootRef,
}: {
  rootRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      aria-hidden="true"
      className="aspect-[224/256] bg-black"
      ref={rootRef}
      style={{
        width: 448,
        maxWidth: "calc(100vw - 3rem)",
      }}
    />
  );
}

export function FooterArcadeSlot() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [shouldLoad]);

  return shouldLoad ? (
    <FooterArcade />
  ) : (
    <FooterArcadePlaceholder rootRef={rootRef} />
  );
}
