'use client';

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  return useCallback(() => {
    if (typeof window === "undefined") return;
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

    if (hasInternalFlag || sameOriginReferrer) {
      const beforeHref = window.location.href;
      router.back();
      window.setTimeout(() => {
        if (window.location.href === beforeHref) {
          router.push(fallbackHref);
        }
      }, 150);
    } else {
      router.push(fallbackHref);
    }
  }, [fallbackHref, router]);
}
