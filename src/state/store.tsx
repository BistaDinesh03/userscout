/* ── App state ──────────────────────────────────────────────────────────
 * Thin reactive layer over the services. Components never talk to the
 * storage adapter directly; they dispatch actions and render state.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Draft, FeedbackEntry, Prospect, ProspectStatus, Project, RateInfo, SafeUser, ScoredCandidate, TimelineEvent, ProjectProfile, DraftChannel } from "../core/types";
import { storage } from "../core/storage";
import { AuthService, DraftService, FeedbackService, ProjectService, ProspectService, listDiscoverable, type CommunityListing } from "../core/services";
import { createGitHubClient, type GitHubClient } from "../core/github";
import { uid } from "../core/utils";

export interface Toast {
  id: string;
  kind: "ok" | "err" | "info";
  text: string;
}

interface Workspace {
  ready: boolean;
  user: SafeUser | null;
  token: string | null;
  projects: Project[];
  prospects: Prospect[];
  events: TimelineEvent[];
  drafts: Draft[];
  feedback: FeedbackEntry[];
  community: CommunityListing[];
  rate: RateInfo;
  toasts: Toast[];
  gh: GitHubClient;
  auth: {
    register: (u: string, p: string) => Promise<void>;
    login: (u: string, p: string) => Promise<void>;
    logout: () => void;
  };
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: string) => void;
  reload: () => void;
  createProject: (profile: ProjectProfile) => Project;
  deleteProject: (id: string) => void;
  setDiscoverable: (id: string, v: boolean) => void;
  markDiscovered: (id: string) => void;
  saveDiscovery: (projectId: string, scored: ScoredCandidate[]) => { created: number; updated: number };
  setStatus: (prospectId: string, to: ProspectStatus, opts?: { channel?: string; note?: string }) => void;
  addNote: (prospectId: string, text: string) => void;
  saveDraft: (prospectId: string, channel: DraftChannel, body: string) => void;
  saveFeedback: (prospectId: string, input: { rating: number; useful: string; confusing: string; improve: string; wouldUseAgain: "yes" | "no" | "maybe"; notes: string }) => void;
}

const Ctx = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [community, setCommunity] = useState<CommunityListing[]>([]);
  const [rate, setRate] = useState<RateInfo>({ coreRemaining: null, coreReset: null, searchRemaining: null, searchReset: null });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const gh = useMemo(() => createGitHubClient((r) => setRate(r)), []);

  const services = useMemo(
    () => ({
      auth: new AuthService(storage),
      projects: new ProjectService(storage),
      prospects: new ProspectService(storage),
      drafts: new DraftService(storage, new ProspectService(storage)),
      feedback: new FeedbackService(storage, new ProspectService(storage)),
    }),
    [],
  );

  const reload = useCallback(() => {
    const u = services.auth.restore(storage.getMeta("session"));
    setUser(u);
    if (u) {
      setProjects(services.projects.list(u.id));
      const pros = storage.read<Prospect>("prospects").filter((p) => p.ownerId === u.id);
      setProspects(pros.sort((a, b) => b.score - a.score));
      const ids = new Set(pros.map((p) => p.id));
      setEvents(storage.read<TimelineEvent>("events").filter((e) => e.ownerId === u.id));
      setDrafts(storage.read<Draft>("drafts").filter((d) => ids.has(d.prospectId)));
      setFeedback(storage.read<FeedbackEntry>("feedback").filter((f) => f.ownerId === u.id));
    } else {
      setProjects([]);
      setProspects([]);
      setEvents([]);
      setDrafts([]);
      setFeedback([]);
    }
    setCommunity(listDiscoverable(storage, u?.id ?? null));
    setReady(true);
  }, [services]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const api = useMemo<Workspace>(() => {
    const actorId = () => {
      if (!user) throw new Error("Sign in first.");
      return user.id;
    };
    return {
      ready,
      user,
      token,
      projects,
      prospects,
      events,
      drafts,
      feedback,
      community,
      rate,
      toasts,
      gh,
      toast,
      dismissToast,
      reload,
      auth: {
        register: async (u, p) => {
          const r = await services.auth.register(u, p);
          storage.setMeta("session", r.token);
          setToken(r.token);
          reload();
        },
        login: async (u, p) => {
          const r = await services.auth.login(u, p);
          storage.setMeta("session", r.token);
          setToken(r.token);
          reload();
        },
        logout: () => {
          services.auth.logout(storage.getMeta("session"));
          storage.setMeta("session", null);
          setToken(null);
          reload();
        },
      },
      createProject: (profile) => {
        const p = services.projects.create(actorId(), profile);
        reload();
        return p;
      },
      deleteProject: (id) => {
        services.projects.remove(actorId(), id);
        reload();
      },
      setDiscoverable: (id, v) => {
        services.projects.update(actorId(), id, { discoverable: v });
        reload();
      },
      markDiscovered: (id) => {
        services.projects.update(actorId(), id, { lastDiscoveryAt: Date.now() });
        reload();
      },
      saveDiscovery: (projectId, scored) => {
        const r = services.prospects.saveResults(actorId(), projectId, scored);
        reload();
        return { created: r.created, updated: r.updated };
      },
      setStatus: (prospectId, to, opts) => {
        services.prospects.setStatus(actorId(), prospectId, to, opts);
        reload();
      },
      addNote: (prospectId, text) => {
        services.prospects.addNote(actorId(), prospectId, text);
        reload();
      },
      saveDraft: (prospectId, channel, body) => {
        services.drafts.upsert(actorId(), prospectId, channel, body);
        reload();
      },
      saveFeedback: (prospectId, input) => {
        services.feedback.save(actorId(), prospectId, input);
        reload();
      },
    };
  }, [ready, user, token, projects, prospects, events, drafts, feedback, community, rate, toasts, gh, toast, dismissToast, reload, services]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}

/* ── scroll restoration for route changes ── */
export function useScrollTop(dep: string) {
  const last = useRef(dep);
  useEffect(() => {
    if (last.current !== dep) {
      last.current = dep;
      window.scrollTo({ top: 0 });
    }
  }, [dep]);
}
