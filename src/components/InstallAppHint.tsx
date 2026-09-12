"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "fitness_os_install_hint_dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

type InstallAppHintProps = {
  placement?: "home" | "account";
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );
  return media || iosStandalone;
}

function detectPlatform(): "ios" | "android" | "other" {
  if (typeof window === "undefined") {
    return "other";
  }
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) {
    return "ios";
  }
  if (/android/i.test(ua)) {
    return "android";
  }
  return "other";
}

export function InstallAppHint({ placement = "home" }: InstallAppHintProps) {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (isStandaloneDisplay()) {
      return;
    }

    const dismissed =
      placement === "home" &&
      window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) {
      return;
    }

    setPlatform(detectPlatform());
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [placement]);

  if (!visible) {
    return null;
  }

  const copy =
    platform === "ios"
      ? "Share → Add to Home Screen"
      : platform === "android"
        ? "Menu → Install app / Add to Home Screen"
        : "Install Fitness OS on your Home Screen for a full-screen gym app.";

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="toast" style={{ marginTop: placement === "account" ? 16 : 0 }}>
      <div className="flex items-start gap-3">
        <Share className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--acc)" }} />
        <div className="min-w-0 flex-1">
          <p className="t-head">Install Fitness OS</p>
          <p className="t-foot" style={{ marginTop: 4 }}>
            {copy}
          </p>
          {installEvent ? (
            <button
              type="button"
              className="btn primary sm"
              style={{ marginTop: 10 }}
              onClick={async () => {
                await installEvent.prompt();
                setInstallEvent(null);
                dismiss();
              }}
            >
              Install
            </button>
          ) : null}
        </div>
        {placement === "home" ? (
          <button
            type="button"
            onClick={dismiss}
            className="iconbtn"
            aria-label="Dismiss install hint"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
