/* UserScout — app entry: providers, hash router (static-host safe), toasts. */

import { useEffect } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { WorkspaceProvider, useWorkspace } from "./state/store";
import { AppShell, Backdrop, RequireAuth } from "./components/layout";
import { IAlert, ICheck, IX } from "./components/icons";
import { cx } from "./core/utils";
import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";
import Discovery from "./pages/Discovery";
import ProspectDetail from "./pages/ProspectDetail";
import Outreach from "./pages/Outreach";
import Community from "./pages/Community";
import { Button } from "./components/ui";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function ToastHost() {
  const { toasts, dismissToast } = useWorkspace();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx("toast-in pointer-events-auto flex items-start gap-2.5 rounded-md border px-3.5 py-3 shadow-panel backdrop-blur-sm", t.kind === "ok" ? "border-leaf-500/40 bg-pine-900/95 text-leaf-300" : t.kind === "err" ? "border-ember-500/40 bg-pine-900/95 text-ember-400" : "border-pine-600 bg-pine-900/95 text-fog-300")}>
          <span className="mt-px shrink-0">{t.kind === "ok" ? <ICheck size={14} /> : t.kind === "err" ? <IAlert size={14} /> : <span className="mt-1 block size-2 rounded-full bg-signal-400" />}</span>
          <p className="flex-1 text-[12.5px] leading-relaxed text-fog-200">{t.text}</p>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="shrink-0 rounded p-0.5 text-fog-500 hover:text-fog-100"><IX size={12} /></button>
        </div>
      ))}
    </div>
  );
}

function NotFound() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal-400">signal lost</p>
      <h1 className="font-display text-[40px] font-extrabold text-fog-100">404 — nothing on this bearing</h1>
      <Link to="/"><Button>Back to base</Button></Link>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <HashRouter>
        <ScrollToTop />
        <Backdrop />
        <ToastHost />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/app" element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
          <Route path="/app/projects" element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
          <Route path="/app/projects/new" element={<RequireAuth><AppShell><ProjectNew /></AppShell></RequireAuth>} />
          <Route path="/app/projects/:id" element={<RequireAuth><AppShell><ProjectDetail /></AppShell></RequireAuth>} />
          <Route path="/app/projects/:id/discovery" element={<RequireAuth><AppShell><Discovery /></AppShell></RequireAuth>} />
          <Route path="/app/prospects/:pid" element={<RequireAuth><AppShell><ProspectDetail /></AppShell></RequireAuth>} />
          <Route path="/app/outreach" element={<RequireAuth><AppShell><Outreach /></AppShell></RequireAuth>} />
          <Route path="/app/community" element={<RequireAuth><AppShell><Community /></AppShell></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </WorkspaceProvider>
  );
}
