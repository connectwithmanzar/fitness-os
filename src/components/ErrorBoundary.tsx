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
        <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="t-title2">Something went wrong</p>
          <button
            type="button"
            className="btn primary"
            style={{ maxWidth: 200 }}
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
