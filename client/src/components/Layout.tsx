import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import crestMark from "@assets/crest_mark.png";
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  BarChart3,
  BookOpen,
  Target,
  Menu,
  X,
  RotateCcw,
  AlertTriangle,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isMuted, setMuted } from "@/hooks/useSound";

const NAV = [
  {
    section: null,
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    section: "Daily",
    items: [
      { href: "/habits", label: "Habits", icon: CheckSquare },
      { href: "/challenge", label: "Challenge", icon: Trophy },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/journal", label: "Journal", icon: BookOpen },
    ],
  },
  {
    section: "Long Game",
    items: [
      { href: "/alignment", label: "Morning Alignment", icon: Target },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [, setMuteTick] = useState(0);

  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));

  async function handleReset() {
    setResetting(true);
    try {
      await apiRequest("POST", "/api/reset", {});
      await queryClient.invalidateQueries();
      setResetOpen(false);
    } catch (e) {
      alert("Reset failed. Try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-background border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={crestMark} alt="TDD" className="w-8 h-8 object-contain" draggable={false} />
          <div className="serif text-xs tracking-widest" style={{fontWeight: 700}}>Tyler's Daily Discipline</div>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary"
          aria-label="Toggle nav"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex-col z-30",
          "hidden md:flex md:sticky md:top-0 md:h-screen",
          mobileOpen && "!flex fixed inset-y-14 left-0 bottom-0 h-[calc(100vh-3.5rem)]"
        )}
      >
        {/* Brand block (desktop only) */}
        <div className="hidden md:flex flex-col items-center pt-8 pb-6 px-6 border-b border-sidebar-border">
          <img src={crestMark} alt="Tyler's Daily Discipline" className="w-24 h-28 object-contain mb-2" draggable={false} />
          <div className="serif text-[13px] leading-tight text-center" style={{fontWeight: 700, letterSpacing: "0.15em"}}>Tyler's Daily</div>
          <div className="serif text-[13px] leading-tight text-center" style={{fontWeight: 700, letterSpacing: "0.15em"}}>Discipline</div>
          <div className="microlabel mt-3">DISCIPLINE · GROWTH · LEGACY</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV.map((group, gi) => (
            <div key={gi} className="mb-2">
              {group.section && <div className="nav-section-label">{group.section}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={() => setMobileOpen(false)}
                      className={cn("nav-item", isActive(item.href) && "active")}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="nav-icon" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className="microlabel">System</div>
          <div className="text-xs text-muted-foreground mt-1 mb-3">v1.0 · Local</div>
          <button
            onClick={() => { setMuted(!isMuted()); setMuteTick((t) => t + 1); }}
            className="w-full text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 rounded px-3 py-2 flex items-center justify-center gap-1.5 transition-colors mb-2"
            data-testid="btn-toggle-sound"
          >
            {isMuted() ? <><VolumeX className="w-3.5 h-3.5" /> Sound off</> : <><Volume2 className="w-3.5 h-3.5" /> Sound on</>}
          </button>
          <button
            onClick={() => setResetOpen(true)}
            className="w-full text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive border border-border hover:border-destructive/60 rounded px-3 py-2 flex items-center justify-center gap-1.5 transition-colors"
            data-testid="btn-reset-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset all data
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 md:pt-0 pt-14">{children}</main>

      {/* Reset confirmation modal */}
      {resetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !resetting && setResetOpen(false)}
        >
          <div
            className="card-lux max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <div className="serif text-lg mb-1">Reset all data?</div>
                <div className="text-sm text-muted-foreground">
                  This permanently deletes every habit log, task, journal entry, and goal. It cannot be undone. Charts and streaks will start fresh from today.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setResetOpen(false)}
                disabled={resetting}
                className="h-9 px-4 rounded border border-border hover:border-foreground/50 text-sm transition-colors disabled:opacity-50"
                data-testid="btn-reset-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="h-9 px-4 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 text-sm font-medium transition-colors disabled:opacity-50"
                data-testid="btn-reset-confirm"
              >
                {resetting ? "Resetting…" : "Yes, wipe everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
