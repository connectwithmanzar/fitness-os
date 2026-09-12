import type { ReactNode } from "react";

type AppBannerProps = {
  children: ReactNode;
  tone?: "ok" | "warn";
};

export function AppBanner({ children, tone = "ok" }: AppBannerProps) {
  return <div className={`toast ${tone}`}>{children}</div>;
}
