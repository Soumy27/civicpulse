"use client";

import Link from "next/link";
import { Activity, MapPin } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
  { href: "/agent", label: "Agent" },
  { href: "/report", label: "Report" },
  { href: "/profile", label: "Profile" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-bold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-4 w-4" />
        </span>
        <span className="text-lg">
          Civic<span className="text-primary">Pulse</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          );
        })}
        <Link
          href="/report"
          className="ml-2 hidden items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:flex"
        >
          <MapPin className="h-4 w-4" /> Report Issue
        </Link>
      </nav>
    </header>
  );
}
