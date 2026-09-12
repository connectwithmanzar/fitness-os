"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import { setGuestMode } from "@/lib/auth-session";
import { downloadBackup, importBackupJson } from "@/lib/backup";
import { getSupabase } from "@/lib/supabaseClient";
import { InstallAppHint } from "@/components/InstallAppHint";

type AuthTab = "signin" | "signup";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange?: (signedIn: boolean) => void;
};

export function AccountButton({
  signedIn,
  onClick,
}: {
  signedIn: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target relative flex min-h-12 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-sm font-semibold text-ink transition hover:border-accent/50 active:scale-95"
      aria-label="Open account"
    >
      <User className="h-3.5 w-3.5" />
      Account
      <span
        className={`h-2 w-2 rounded-full ${
          signedIn ? "bg-accent" : "bg-faint"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

export function AuthModal({ isOpen, onClose, onAuthChange }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setError(null);
    const client = getSupabase();
    if (!client) {
      setUserEmail(null);
      return;
    }

    let active = true;
    const load = async () => {
      const { data, error: sessionError } = await client.auth.getSession();
      if (!active) {
        return;
      }
      if (sessionError) {
        setError(sessionError.message);
      }
      setUserEmail(data?.session?.user?.email ?? null);
    };

    void load();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const client = getSupabase();
    if (!client) {
      setError("Cloud auth is unavailable. Continue as guest.");
      setBusy(false);
      return;
    }

    try {
      if (tab === "signup") {
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data?.session) {
          setGuestMode(false);
          setUserEmail(data?.user?.email ?? email);
          onAuthChange?.(true);
          return;
        }
        setError("Account created. Confirm your email, then sign in.");
        setTab("signin");
        return;
      }

      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      setGuestMode(false);
      setUserEmail(data?.user?.email ?? email);
      onAuthChange?.(true);
      onClose();
    } catch {
      setError("Could not reach Supabase. Continue as guest.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      const client = getSupabase();
      if (client) {
        await client.auth.signOut();
      }
      setUserEmail(null);
      setGuestMode(true);
      onAuthChange?.(false);
    } catch {
      setError("Sign out failed. You are still in local mode.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-t-[1.75rem] border border-line bg-raised p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-float sm:rounded-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id="auth-title" className="font-display text-lg font-semibold text-ink">
            Account
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tap-target flex h-12 w-12 items-center justify-center rounded-full text-mute transition hover:text-ink active:scale-98"
            aria-label="Close account"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userEmail ? (
          <div>
            <p className="text-sm text-mute">Signed in as</p>
            <p className="mt-1 text-sm font-semibold text-ink">{userEmail}</p>
            <p className="chip-accent mt-3">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              Cloud sync on
            </p>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              disabled={busy}
              className="btn-secondary mt-5 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab("signin")}
                className={`tap-target min-h-12 rounded-control py-3 text-sm font-semibold transition active:scale-95 ${
                  tab === "signin"
                    ? "bg-accent text-accent-fg"
                    : "border border-line bg-inset text-mute"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`tap-target min-h-12 rounded-control py-3 text-sm font-semibold transition active:scale-95 ${
                  tab === "signup"
                    ? "bg-accent text-accent-fg"
                    : "border border-line bg-inset text-mute"
                }`}
              >
                Create Account
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="input-field"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="input-field"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-primary disabled:opacity-70"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-accent-fg" /> : null}
                {tab === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        )}

        {error ? (
          <p className="mt-3 text-sm font-medium text-warn">{error}</p>
        ) : null}

        <InstallAppHint placement="account" />

        <div className="mt-5 surface-muted p-3">
          <p className="eyebrow">Local backup</p>
          <p className="mt-1 text-xs text-mute">
            Export or merge meals, workouts, targets, and splits. No cloud required.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                downloadBackup();
                setBackupNote("Backup downloaded.");
              }}
              className="btn-secondary"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
            >
              Import JSON
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) {
                return;
              }
              if (
                !window.confirm(
                  "Merge this backup into local data? Matching ids will be overwritten."
                )
              ) {
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const text = typeof reader.result === "string" ? reader.result : "";
                  importBackupJson(text);
                  setBackupNote("Backup merged. Reloading…");
                  window.setTimeout(() => {
                    window.location.reload();
                  }, 400);
                } catch {
                  setError("Could not read that backup file.");
                }
              };
              reader.readAsText(file);
            }}
          />
          {backupNote ? (
            <p className="mt-2 text-xs text-accent">{backupNote}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            setGuestMode(true);
            onClose();
          }}
          className="mt-4 w-full text-center text-sm text-mute underline-offset-4 hover:text-ink hover:underline"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
