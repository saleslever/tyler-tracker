import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CheckSquare,
  ListTodo,
  BarChart3,
  BookOpen,
  Target,
  Menu,
  X,
  AlertTriangle,
  Trophy,
  Swords,
  Crown,
  HeartPulse,
  Timer,
  Settings as SettingsIcon,
  MessageSquare,
  Zap,
  Upload as UploadIcon,
  Moon,
  Sun,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV = [
  {
    section: "Coach",
    items: [
      { href: "/coach", label: "Coach", icon: MessageSquare },
      { href: "/generate", label: "Generate Workout", icon: Zap },
      { href: "/uploads", label: "Bulk Uploads", icon: UploadIcon },
    ],
  },
  {
    section: "Daily",
    items: [
      { href: "/habits", label: "Habits", icon: CheckSquare },
      { href: "/fasting", label: "Fasting", icon: Timer },
      { href: "/mood", label: "Mood", icon: HeartPulse },
      { href: "/tasks", label: "Tasks", icon: ListTodo },
      { href: "/journal", label: "Journal", icon: BookOpen },
    ],
  },
  {
    section: "Long Game",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

interface CoachContext {
  today: string;
  todayChecklist: Array<{ id: number; task: string; status: string; dueTime?: string | null }>;
}

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);
  return [isDark, () => setIsDark(v => !v)] as const;
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, toggleTheme] = useTheme();

  // Pull today's checklist to compute nag count for the Coach badge
  const { data: coachContext } = useQuery<CoachContext>({
    queryKey: ["/api/coach/context"],
    refetchInterval: 60000,
  });

  const nagCount = (coachContext?.todayChecklist ?? []).filter(c => c.status === "pending").length;

  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 inset-x-0 z-40 bg-background border-b border-border flex items-center justify-between px-4"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          height: "calc(3.5rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <BrandMark />
          <div className="font-display text-sm font-bold truncate">Coach OS</div>
          {nagCount > 0 && <span className="nag-badge" data-testid="nag-badge-mobile">{nagCount}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-secondary shrink-0"
            aria-label="Toggle nav"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex-col z-30",
          "hidden md:flex md:sticky md:top-0 md:h-screen",
          mobileOpen && "!flex fixed inset-y-14 left-0 bottom-0 h-[calc(100vh-3.5rem)]"
        )}
      >
        {/* Brand block */}
        <div className="hidden md:flex items-center gap-3 px-5 pt-6 pb-5 border-b border-sidebar-border">
          <BrandMark />
          <div>
            <div className="font-display text-base font-bold leading-tight" style={{ letterSpacing: "-0.02em" }}>
              Coach OS
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Tyler Clark
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV.map((group, gi) => (
            <div key={gi} className="mb-4">
              {group.section && (
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold px-2 mb-1.5">
                  {group.section}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const showNag = item.href === "/coach" && nagCount > 0;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
                      <span className="flex-1">{item.label}</span>
                      {showNag && (
                        <span className="nag-badge" data-testid="nag-badge-sidebar">
                          {nagCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <button
            onClick={toggleTheme}
            className="w-full text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-md px-3 py-2 flex items-center justify-center gap-1.5 transition-colors"
            data-testid="btn-toggle-theme"
          >
            {isDark ? <><Sun className="w-3.5 h-3.5" /> Light</> : <><Moon className="w-3.5 h-3.5" /> Dark</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 mobile-safe-top mobile-safe-bottom md:!pt-0 md:!pb-0">{children}</main>

      {/* Mobile bottom tab bar — coach-focused */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 h-14">
          {[
            { href: "/coach", label: "Home", icon: BarChart3 },
            { href: "/atlas", label: "Atlas", icon: MessageSquare, primary: true },
            { href: "/generate", label: "Workout", icon: Zap },
            { href: "/habits", label: "Habits", icon: CheckSquare },
            { href: "/fasting", label: "Fast", icon: Timer },
          ].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const showNag = item.href === "/atlas" && nagCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 h-full text-[10px] uppercase tracking-wider transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    (item as any).primary && !active && "text-foreground"
                  )}
                  data-testid={`tab-${item.label.toLowerCase()}`}
                >
                  {(item as any).primary && (
                    <div className="absolute -top-3 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg ring-2 ring-background">
                      <Icon className="w-5 h-5" />
                    </div>
                  )}
                  {!(item as any).primary && <Icon className="w-5 h-5" />}
                  <span className={cn((item as any).primary && "mt-6 font-bold")}>{item.label}</span>
                  {showNag && (
                    <span className="absolute top-1 right-[calc(50%-1.75rem)] nag-badge" style={{ minWidth: "1rem", height: "1rem", fontSize: "0.625rem" }}>
                      {nagCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function BrandMark() {
  // Simple gold monogram SVG — dangerous & clean, no cheesy crown
  return (
    <svg
      viewBox="0 0 40 40"
      className="w-8 h-8 shrink-0"
      fill="none"
      aria-label="Coach OS"
    >
      <rect x="1" y="1" width="38" height="38" rx="8" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <path
        d="M11 12 L20 28 L29 12"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="1.75" fill="hsl(var(--primary))" />
    </svg>
  );
}
