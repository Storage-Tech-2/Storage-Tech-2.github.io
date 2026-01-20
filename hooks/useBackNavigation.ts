'use client';

import { useCallback } from "react";

export const NAV_SESSION_KEY = "archive-nav-origin";

export function setInternalNavigationFlag() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
  try {
    window.sessionStorage.setItem(NAV_SESSION_KEY, "1");
  } catch {
    // ignore write failures
  }
}

export function useBackNavigation(fallbackHref: string) {
  return useCallback(() => {
    if (typeof window === "undefined") return;
    const hasHistory = window.history.length > 1;
    const hasInternalFlag = (() => {
      try {
        return typeof window.sessionStorage !== "undefined" && window.sessionStorage.getItem(NAV_SESSION_KEY) === "1";
      } catch {
        return false;
      }
    })();
    let sameOriginReferrer = false;
    if (document.referrer) {
      try {
        sameOriginReferrer = new URL(document.referrer).origin === window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
    }

    if (hasHistory && (hasInternalFlag || sameOriginReferrer)) {
      window.history.back();
    } else {
      window.location.href = fallbackHref;
    }
  }, [fallbackHref]);
}
