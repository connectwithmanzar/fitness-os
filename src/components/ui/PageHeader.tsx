import type { ReactNode } from "react";

type PageHeaderProps = {
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ kicker, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 -mx-5 mb-1 flex items-start justify-between gap-3 border-b border-line bg-canvas/80 px-5 py-3 backdrop-blur-xl">
      <div className="min-w-0">
        {kicker ? (
          <p className="eyebrow flex items-center gap-2">
            <span className="os-dot" aria-hidden="true" />
            {kicker}
          </p>
        ) : null}
        <h1 className="display-title mt-2 truncate">{title}</h1>
        {subtitle ? <div className="mt-2 text-sm text-mute">{subtitle}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-col items-end gap-2">{action}</div> : null}
    </header>
  );
}
