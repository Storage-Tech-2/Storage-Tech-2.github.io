'use client';

import { useCallback } from "react";

export function useBackNavigation(fallbackHref: string) {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    const ref = document.referrer;
    let sameOrigin = false;
    if (ref) {
      try {
        sameOrigin = new URL(ref).origin === window.location.origin;
      } catch {
        sameOrigin = false;
      }
    }

    if (sameOrigin) {
      window.history.back();
    } else {
      window.location.replace(fallbackHref);
    }
  }, [fallbackHref]);
}
