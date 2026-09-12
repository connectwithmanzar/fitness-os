import type { ReactNode } from "react";

type AppBannerProps = {
  children: ReactNode;
  tone?: "ok" | "warn";
};

export function AppBanner({ children, tone = "ok" }: AppBannerProps) {
  return (
    <div
      className={`mt-4 rounded-control px-3 py-2.5 text-sm font-medium ${
        tone === "ok" ? "bg-accent/12 text-accent" : "bg-warn/15 text-warn"
      }`}
    >
      {children}
    </div>
  );
}
