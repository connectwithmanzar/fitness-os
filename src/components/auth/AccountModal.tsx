"use client";

import { useEffect, useState } from "react";
import { User, X } from "lucide-react";
import { isGuestMode, setGuestMode } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

type AccountModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AccountTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-emerald-500 hover:text-emerald-300 active:scale-98"
      aria-label="Open account"
    >
      <User className="h-3.5 w-3.5" />
      Account
    </button>
  );
}

export function AccountModal({ open, onClose }: AccountModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setGuest(isGuestMode());
    setMessage(null);

    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) {
        return;
      }
      setUserEmail(data.user?.email ?? null);
    };

    void load();
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user.email ?? null);
      }
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setMessage(error.message);
          return;
        }
        setGuestMode(false);
        setGuest(false);
        setMessage("Account created. Check email if confirmation is required.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setGuestMode(false);
      setGuest(false);
      onClose();
    } catch {
      setMessage("Auth is unavailable. Continue as guest.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setUserEmail(null);
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
        aria-labelledby="account-title"
        className="w-full max-w-md rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="account-title" className="text-lg font-semibold text-white">
            Account
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
            <button
              type="button"
              onClick={() => {
                void signOut();
              }}
              disabled={busy}
              className="mt-5 w-full rounded-xl border border-neutral-700 py-3 text-sm font-semibold text-neutral-100 transition active:scale-98 disabled:opacity-60"
            >
              Sign Out
            </button>
          </div>
        ) : (
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
              className="h-12 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="h-12 rounded-xl border border-neutral-800 bg-neutral-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition active:scale-98 disabled:opacity-60"
            >
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-xs text-neutral-400"
            >
              {mode === "signin"
                ? "Need an account? Sign up"
                : "Have an account? Sign in"}
            </button>
          </form>
        )}

        {message ? <p className="mt-3 text-xs text-amber-300">{message}</p> : null}

        <button
          type="button"
          onClick={() => {
            setGuestMode(true);
            setGuest(true);
            onClose();
          }}
          className={`mt-4 w-full rounded-xl border py-3 text-sm font-medium transition active:scale-98 ${
            guest
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-neutral-800 text-neutral-300"
          }`}
        >
          Continue as Guest (Offline Mode)
        </button>
      </div>
    </div>
  );
}
