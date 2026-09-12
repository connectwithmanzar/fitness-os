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
      className="tap-target relative flex min-h-12 items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 px-3.5 text-sm font-semibold text-white transition hover:border-emerald-500 active:scale-95"
      aria-label="Open account"
    >
      <User className="h-3.5 w-3.5" />
      Account
      <span
        className={`h-2 w-2 rounded-full ${
          signedIn ? "bg-emerald-400" : "bg-neutral-600"
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="auth-title" className="text-lg font-semibold text-white">
            Account & Cloud Sync
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 transition hover:text-white active:scale-98"
            aria-label="Close account"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userEmail ? (
          <div>
            <p className="text-sm text-neutral-400">Signed in as</p>
            <p className="mt-1 text-sm font-semibold text-white">{userEmail}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Cloud Sync Active
            </p>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              disabled={busy}
              className="tap-target mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 py-3.5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-60"
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
                className={`tap-target min-h-12 rounded-xl py-3 text-sm font-semibold transition active:scale-95 ${
                  tab === "signin"
                    ? "bg-emerald-500 text-black"
                    : "border border-neutral-800 bg-neutral-900 text-neutral-300"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`tap-target min-h-12 rounded-xl py-3 text-sm font-semibold transition active:scale-95 ${
                  tab === "signup"
                    ? "bg-emerald-500 text-black"
                    : "border border-neutral-800 bg-neutral-900 text-neutral-300"
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
                className="min-h-12 rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-base text-white outline-none focus:border-emerald-500"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="min-h-12 rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-base text-white outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="tap-target flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-70"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : null}
                {tab === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        )}

        {error ? (
          <p className="mt-3 text-sm font-medium text-amber-300">{error}</p>
        ) : null}

        <InstallAppHint placement="account" />

        <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Local backup
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Export or merge meals, workouts, targets, and splits. No cloud required.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                downloadBackup();
                setBackupNote("Backup downloaded.");
              }}
              className="tap-target min-h-12 rounded-xl border border-neutral-700 py-3 text-sm font-semibold text-white transition active:scale-95"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="tap-target min-h-12 rounded-xl border border-neutral-700 py-3 text-sm font-semibold text-white transition active:scale-95"
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
            <p className="mt-2 text-xs text-emerald-300">{backupNote}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            setGuestMode(true);
            onClose();
          }}
          className="mt-4 w-full text-center text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
