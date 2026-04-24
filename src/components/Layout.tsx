import { NavLink, Outlet } from "react-router-dom";
import { theme } from "@/theme";
import ModeBanner from "./ModeBanner";

const navItems = [
  { to: "/", label: "Close Cockpit", end: true },
  { to: "/contracts", label: "Contracts" },
  { to: "/review", label: "Review Queue" },
  { to: "/narrative", label: "Narrative" },
  { to: "/copilot", label: "Copilot" },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <ModeBanner />
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-brand-border px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-extrabold tracking-[2px]">
            {theme.brandName}
          </span>
          <div className="w-px h-5 bg-brand-border" />
          <span className="font-display text-sm font-semibold text-brand-text-muted tracking-[1.5px] uppercase">
            {theme.productName} · {theme.tagline}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-[10px] font-semibold text-brand-accent tracking-[2px] border border-brand-accent/30 bg-brand-accent-dim px-2 py-0.5 uppercase">
            Prototype
          </span>
          <span className="font-display text-[10px] font-semibold text-brand-text-muted tracking-[2px] border border-brand-border px-2 py-0.5 uppercase">
            v0.1
          </span>
        </div>
      </header>
      <nav className="sticky top-16 z-40 bg-black/90 backdrop-blur border-b border-brand-border px-10 flex gap-0 overflow-x-auto">
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `px-6 py-3 font-display text-sm font-semibold uppercase tracking-[1px] border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "text-brand-text border-brand-accent"
                  : "text-brand-text-muted border-transparent hover:text-brand-text"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-10 py-14">
        <Outlet />
      </main>
      <footer className="border-t border-brand-border px-10 py-4 text-center text-[11px] text-brand-text-dim font-mono">
        {theme.brandName} · {theme.productName} Prototype · Deloitte Engagement Reference Demo
      </footer>
    </div>
  );
}
