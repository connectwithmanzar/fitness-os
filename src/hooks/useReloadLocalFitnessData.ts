"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FITNESS_DATA_CHANGED_EVENT } from "@/lib/fitness-events";

export function useReloadLocalFitnessData(): number {
  const pathname = usePathname();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => {
      setTick((current) => current + 1);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        bump();
      }
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(FITNESS_DATA_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(FITNESS_DATA_CHANGED_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    setTick((current) => current + 1);
  }, [pathname]);

  return tick;
}
