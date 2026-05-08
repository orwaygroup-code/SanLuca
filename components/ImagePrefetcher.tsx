"use client";

import { useEffect } from "react";

/**
 * Prefetches a list of image URLs on idle (post-hero load).
 * Browser cache stores them so subsequent navigations are instant.
 *
 * Uso: <ImagePrefetcher urls={["/images/...", ...]} />
 */
export function ImagePrefetcher({ urls }: { urls: string[] }) {
  useEffect(() => {
    if (!urls?.length) return;

    type IC = (cb: () => void, opts?: { timeout: number }) => number;
    const ric = (window as unknown as { requestIdleCallback?: IC }).requestIdleCallback;
    const schedule = ric ?? ((cb: () => void) => window.setTimeout(cb, 1500));

    const handle = schedule(() => {
      for (const href of urls) {
        // <link rel="prefetch" as="image"> — bajo prioridad, sin bloquear render
        const link = document.createElement("link");
        link.rel  = "prefetch";
        link.as   = "image";
        link.href = href;
        document.head.appendChild(link);
      }
    }, { timeout: 3000 });

    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cancel && typeof handle === "number") cancel(handle);
    };
  }, [urls]);

  return null;
}
