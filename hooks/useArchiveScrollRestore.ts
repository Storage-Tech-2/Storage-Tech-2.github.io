'use client';

import { useEffect } from "react";
import type { RefObject } from "react";

type Options = {
  pendingScrollRef: RefObject<number | null>;
  isPostOpen: boolean;
  restoreKey?: number;
  hydrated: boolean;
};

export function useArchiveScrollRestore({
  pendingScrollRef,
  hydrated,
  isPostOpen,
  restoreKey,
}: Options) {
  useEffect(() => {
    const captureScroll = () => {
      const savedScroll = sessionStorage.getItem("archive-scroll");
      if (!savedScroll) return;
      const y = parseInt(savedScroll, 10);
      if (!Number.isNaN(y)) pendingScrollRef.current = y;
    };
    const restoreScroll = () => {
      if (!hydrated || isPostOpen) return;
      const y = pendingScrollRef.current;
      if (y === null) return;
      requestAnimationFrame(() => window.scrollTo(0, y));
      pendingScrollRef.current = null;
      sessionStorage.removeItem("archive-scroll");
    };
    captureScroll();
    restoreScroll();
    window.addEventListener("popstate", captureScroll);
    window.addEventListener("popstate", restoreScroll);
    window.addEventListener("pageshow", captureScroll);
    window.addEventListener("pageshow", restoreScroll);
    return () => {
      window.removeEventListener("popstate", captureScroll);
      window.removeEventListener("popstate", restoreScroll);
      window.removeEventListener("pageshow", captureScroll);
      window.removeEventListener("pageshow", restoreScroll);
    };
  }, [hydrated, isPostOpen, pendingScrollRef]);

  useEffect(() => {
    if (!hydrated || isPostOpen) return;
    if (pendingScrollRef.current === null) return;
    requestAnimationFrame(() => {
      const y = pendingScrollRef.current;
      if (y === null) return;
      window.scrollTo(0, y);
      pendingScrollRef.current = null;
    });
  }, [hydrated, isPostOpen, pendingScrollRef, restoreKey]);
}
