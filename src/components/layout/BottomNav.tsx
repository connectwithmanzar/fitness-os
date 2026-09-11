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
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-neutral-800 bg-neutral-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
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
                className={`flex flex-col items-center gap-1 px-2 py-3 text-xs font-medium transition active:scale-95 ${
                  isActive
                    ? "text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
