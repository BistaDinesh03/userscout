/* App shell: ambient backdrop, sidebar, topbar, auth guard. */

import type { ReactNode } from "react";
import { Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../state/store";
import { cx, timeAgo } from "../core/utils";
import { RateChip } from "./bits";
import { ICompass, IInbox, ILayers, ILogout, IRadar } from "./icons";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? 30 : size === "sm" ? 18 : 22;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-signal-400">
        <IRadar size={s} />
      </span>
      <span className={cx("font-display font-bold tracking-tight", size === "lg" ? "text-[22px]" : "text-[17px]")}>
        User<span className="text-signal-400">Scout</span>
      </span>
    </span>
  );
}

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div className="backdrop-topo absolute inset-0 opacity-60" />
      <div className="backdrop-grid absolute inset-0" />
    </div>
  );
}

const NAV = [
  { to: "/app/projects", label: "Projects", icon: ILayers, end: false },
  { to: "/app/outreach", label: "Outreach", icon: IInbox, end: false },
  { to: "/app/community", label: "Community", icon: ICompass, end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, auth, rate, toast } = useWorkspace();
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[196px] flex-col border-r border-pine-700/70 bg-pine-900/90 md:flex">
        <div className="flex h-14 items-center border-b border-pine-700/70 px-4">
          <NavLink to="/app/projects" aria-label="UserScout home">
            <Logo />
          </NavLink>
        </div>
        <nav className="flex-1 space-y-0.5 p-2.5" aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  "group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors",
                  isActive || (n.to === "/app/projects" && loc.pathname.startsWith("/app/prospects"))
                    ? "bg-pine-750 text-signal-300 shadow-[inset_2px_0_0_0_var(--color-signal-500)]"
                    : "text-fog-400 hover:bg-pine-800 hover:text-fog-100",
                )
              }
            >
              <n.icon size={15} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-pine-700/70 p-3">
          <div className="mb-2 rounded-md border border-pine-700/60 bg-pine-850 px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-fog-500">Philosophy</div>
            <div className="mt-0.5 font-mono text-[11px] text-fog-300">quality &gt; quantity</div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] text-fog-300">
              <span className="text-fog-500">@</span>
              {user?.username}
            </span>
            <button
              onClick={() => {
                auth.logout();
                toast("info", "Signed out. Private notes stayed on this device.");
                nav("/");
              }}
              className="rounded-md p-1.5 text-fog-400 hover:bg-pine-700 hover:text-ember-400"
              aria-label="Sign out"
              title="Sign out"
            >
              <ILogout size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-h-screen w-full flex-col md:pl-[196px]">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-pine-700/70 bg-pine-950/85 px-4 backdrop-blur-sm md:px-7">
          <div className="flex items-center gap-3 md:hidden">
            <Logo size="sm" />
          </div>
          <Crumbs />
          <div className="flex items-center gap-3">
            <RateChip rate={rate} />
            <span className="hidden font-mono text-[11px] text-fog-500 sm:inline">{user ? `@${user.username}` : ""}</span>
          </div>
        </header>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-b border-pine-700/70 bg-pine-950/85 px-2 py-1.5 md:hidden" aria-label="Main mobile">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cx(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  isActive || (n.to === "/app/projects" && loc.pathname.startsWith("/app/prospects"))
                    ? "bg-pine-750 text-signal-300"
                    : "text-fog-400 hover:text-fog-100",
                )
              }
            >
              <n.icon size={13} /> {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              auth.logout();
              nav("/");
            }}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-fog-400 hover:text-ember-400"
          >
            <ILogout size={13} /> Sign out
          </button>
        </nav>

        <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        <footer className="border-t border-pine-800 px-4 py-4 text-[11px] text-fog-500 md:px-8">
          <span className="font-mono">UserScout · MIT · local-first build · your outreach history never leaves this device</span>
        </footer>
      </div>
    </div>
  );
}

function Crumbs() {
  const loc = useLocation();
  const seg = loc.pathname.split("/").filter(Boolean);
  const map: Record<string, string> = {
    app: "workspace",
    projects: "projects",
    new: "new project",
    discovery: "discovery",
    outreach: "outreach",
    community: "community",
    prospects: "prospect",
  };
  const trail = seg.map((s) => map[s] ?? (s.length > 10 ? `${s.slice(0, 8)}…` : s));
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 font-mono text-[11.5px] text-fog-500 md:flex">
      {trail.map((t, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-pine-600">/</span>}
          <span className={i === trail.length - 1 ? "text-fog-200" : ""}>{t}</span>
        </span>
      ))}
    </nav>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, user, token } = useWorkspace();
  // A session token without a loaded user means auth just completed (or is
  // restoring) — show the loader instead of redirecting away.
  if (!ready || (!user && token)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-[13px] text-fog-400">
          <span className="size-2 animate-pulse rounded-full bg-signal-400" />
          restoring session…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-tight text-fog-100">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-fog-400">{sub}</p>}
      </div>
      {right && <div className="flex w-full items-center gap-2 sm:w-auto">{right}</div>}
    </div>
  );
}

export function TimeNote({ ts }: { ts: number | null }) {
  if (!ts) return null;
  return <span className="font-mono text-[10.5px] text-fog-500">{timeAgo(ts)}</span>;
}
