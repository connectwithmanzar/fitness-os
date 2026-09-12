"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center">
          <p className="text-sm font-medium text-neutral-200">
            Something went wrong — Reload
          </p>
          <button
            type="button"
            className="tap-target min-h-12 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-black transition active:scale-95"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
