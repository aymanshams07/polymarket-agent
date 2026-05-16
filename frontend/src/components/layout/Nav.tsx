"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Markets" },
  { href: "/market", label: "Analysis" },
];

export function Nav() {
  const path = usePathname();
  const active = path === "/" ? "/" : path.startsWith("/market") ? "/market" : null;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-zinc-900">POLYMARKET</span>
          <span className="text-[10px] font-semibold tracking-widest text-zinc-400 uppercase">AI</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                active === href
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
