"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Settings, X } from "lucide-react";
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
      className="iconbtn"
      aria-label="Open account"
    >
      <Settings className="h-4 w-4" strokeWidth={1.7} />
      <span className={`dot ${signedIn ? "on" : ""}`} aria-hidden="true" />
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
    <div className="sheet-back" style={{ zIndex: 80 }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grab" />
        <div className="mb-4 row between">
          <h3 id="auth-title">Account</h3>
          <button
            type="button"
            onClick={onClose}
            className="iconbtn"
            aria-label="Close account"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {userEmail ? (
          <div>
            <p className="t-foot">Signed in as</p>
            <p className="t-head" style={{ marginTop: 4 }}>
              {userEmail}
            </p>
            <span className="chip acc" style={{ marginTop: 12 }}>
              Cloud sync on
            </span>
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              disabled={busy}
              className="btn"
              style={{ marginTop: 20 }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign Out
            </button>
          </div>
        ) : (
          <>
            <div className="row">
              <button
                type="button"
                onClick={() => setTab("signin")}
                className={`btn ${tab === "signin" ? "primary" : ""}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab("signup")}
                className={`btn ${tab === "signup" ? "primary" : ""}`}
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
                className="field"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="field"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn primary"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-accent-fg" /> : null}
                {tab === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>
          </>
        )}

        {error ? (
          <p className="mt-3 t-foot" style={{ color: "var(--orange)" }}>
            {error}
          </p>
        ) : null}

        <InstallAppHint placement="account" />

        <div className="card" style={{ marginTop: 20 }}>
          <h2>Local backup</h2>
          <p className="t-foot">
            Export or merge meals, workouts, targets, and splits. No cloud required.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                downloadBackup();
                setBackupNote("Backup downloaded.");
              }}
              className="btn"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn"
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
            <p className="t-foot" style={{ marginTop: 8, color: "var(--acc)" }}>
              {backupNote}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            setGuestMode(true);
            onClose();
          }}
          className="btn ghost"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
