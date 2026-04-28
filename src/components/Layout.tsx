import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { Terminal } from "lucide-react";
import { theme } from "@/theme";
import { useUiStore } from "@/store/uiStore";
import ModeBanner from "./ModeBanner";
import LiveConsoleDock from "./LiveConsoleDock";

const navItems = [
  { to: "/contracts", label: "Contracts" },
  { to: "/review", label: "Review Queue" },
  { to: "/narrative", label: "Narrative" },
  { to: "/copilot", label: "NOAH Help" },
  { to: "/", label: "Close Cockpit", end: true, pushRight: true },
];

export default function Layout() {
  const liveConsoleVisible = useUiStore((s) => s.liveConsoleVisible);
  const toggleLiveConsole = useUiStore((s) => s.toggleLiveConsole);

  // Ctrl+Shift+L toggles the live console (mirrors ModeBanner's Ctrl+Shift+D)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        toggleLiveConsole();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleLiveConsole]);

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
          <button
            type="button"
            onClick={toggleLiveConsole}
            title="Toggle Live Console (Ctrl+Shift+L)"
            aria-pressed={liveConsoleVisible}
            className={clsx(
              "font-display text-[10px] font-semibold tracking-[2px] border px-2 py-0.5 uppercase flex items-center gap-1.5 transition-colors",
              liveConsoleVisible
                ? "text-brand-accent border-brand-accent/30 bg-brand-accent-dim"
                : "text-brand-text-muted border-brand-border hover:text-brand-text"
            )}
          >
            <Terminal size={11} />
            Console
          </button>
          <span className="font-display text-[10px] font-semibold text-brand-accent tracking-[2px] border border-brand-accent/30 bg-brand-accent-dim px-2 py-0.5 uppercase">
            Prototype
          </span>
          <span className="font-display text-[10px] font-semibold text-brand-text-muted tracking-[2px] border border-brand-border px-2 py-0.5 uppercase">
            v0.1
          </span>
        </div>
      </header>
      <nav className="sticky top-16 z-40 bg-black/90 backdrop-blur border-b border-brand-border px-10 flex gap-0 overflow-x-auto">
        {navItems.map(({ to, label, end, pushRight }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `${pushRight ? "ml-auto" : ""} px-6 py-3 font-display text-sm font-semibold uppercase tracking-[1px] border-b-2 whitespace-nowrap transition-colors ${
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
      <LiveConsoleDock />
    </div>
  );
}
