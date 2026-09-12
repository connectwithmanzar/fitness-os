"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Utensils } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Workout", icon: Dumbbell },
  { href: "/diet", label: "Diet Engine", icon: Utensils },
  { href: "/pulse", label: "Pulse", icon: Activity },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[60] mx-auto max-w-md border-t border-neutral-800 bg-neutral-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:border-x sm:border-neutral-800">
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch
                className={`tap-target flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-3 text-[13px] font-medium touch-manipulation transition active:scale-95 ${
                  isActive
                    ? "text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
