"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Utensils } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Train", icon: Dumbbell },
  { href: "/diet", label: "Eat", icon: Utensils },
  { href: "/pulse", label: "Today", icon: Activity },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <ul className="pointer-events-auto mx-auto grid max-w-md grid-cols-3 rounded-full border border-line bg-raised/90 p-1 shadow-float backdrop-blur-xl">
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
                className={`tap-target flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 text-[11px] touch-manipulation transition active:scale-95 ${
                  isActive
                    ? "bg-accent/12 font-semibold text-accent"
                    : "font-medium text-mute hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
