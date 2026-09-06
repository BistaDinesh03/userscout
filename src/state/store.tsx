/* App state — thin reactive layer over backend API. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Draft, FeedbackEntry, Prospect, ProspectStatus, Project, RateInfo, SafeUser, ScoredCandidate, TimelineEvent, ProjectProfile, DraftChannel } from "../core/types";
import { api } from "../core/api";
import { createGitHubClient, type GitHubClient } from "../core/github";
import type { CommunityListing } from "../core/services";
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
    logout: () => Promise<void>;
  };
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: string) => void;
  reload: () => Promise<void>;
  createProject: (profile: ProjectProfile) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  setDiscoverable: (id: string, v: boolean) => Promise<void>;
  markDiscovered: (id: string) => Promise<void>;
  saveDiscovery: (projectId: string, scored: ScoredCandidate[]) => Promise<{ created: number; updated: number }>;
  setStatus: (prospectId: string, to: ProspectStatus, opts?: { channel?: string; note?: string }) => Promise<void>;
  addNote: (prospectId: string, text: string) => Promise<void>;
  saveDraft: (prospectId: string, channel: DraftChannel, body: string) => Promise<void>;
  saveFeedback: (prospectId: string, input: { rating: number; useful: string; confusing: string; improve: string; wouldUseAgain: "yes" | "no" | "maybe"; notes: string }) => Promise<void>;
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

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const reload = useCallback(async () => {
    try {
      const meRes = await api.me() as any;
      const userData = meRes.user || meRes;
      setUser({ id: userData.id, username: userData.username, createdAt: new Date(userData.created_at || Date.now()).getTime() });
      
      const [projRes, prospRes] = await Promise.all([
        api.listProjects() as Promise<{ projects?: Project[] }>,
        api.listProspects() as Promise<{ prospects?: Prospect[] }>,
      ]);
      
      setProjects(projRes.projects || []);
      setProspects(prospRes.prospects || []);
      setEvents([]);
      setDrafts([]);
      setFeedback([]);
    } catch {
      setUser(null);
      setProjects([]);
      setProspects([]);
      setEvents([]);
      setDrafts([]);
      setFeedback([]);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const api_ = useMemo<Workspace>(() => {
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
          const r = await api.register(u, p) as any;
          const userData = r.user || r;
          setUser({ id: userData.id, username: userData.username, createdAt: new Date(userData.created_at || Date.now()).getTime() });
          await reload();
        },
        login: async (u, p) => {
          const r = await api.login(u, p) as any;
          const userData = r.user || r;
          setUser({ id: userData.id, username: userData.username, createdAt: new Date(userData.created_at || Date.now()).getTime() });
          await reload();
        },
        logout: async () => {
          await api.logout();
          setUser(null);
          setProjects([]);
          setProspects([]);
          setEvents([]);
          setDrafts([]);
          setFeedback([]);
        },
      },
      createProject: async (profile) => {
        const r = await api.createProject(profile) as { project: Project };
        await reload();
        return r.project;
      },
      deleteProject: async () => { await reload(); },
      setDiscoverable: async () => { await reload(); },
      markDiscovered: async () => { await reload(); },
      saveDiscovery: async (projectId, scored) => {
        let created = 0;
        for (const s of scored) {
          await api.createProspect({
            project_id: projectId,
            login: s.candidate.login,
            name: s.candidate.name,
            avatar_url: s.candidate.avatarUrl,
            html_url: s.candidate.htmlUrl,
            bio: s.candidate.bio,
            score: s.score,
            confidence: s.confidence,
            explanation: s.explanation,
            signals: s.signals,
            sources: s.candidate.sources,
            contact_channels: s.candidate.contactChannels || [],
            context: { relevantRepos: s.candidate.relatedRepos || [], languages: s.candidate.languages || [], technologies: s.candidate.repoTopics || [] },
            caution_signals: [],
            last_activity_at: s.candidate.lastActivityAt ? new Date(s.candidate.lastActivityAt).toISOString() : null,
            recommended_action: "",
          });
          created++;
        }
        await reload();
        return { created, updated: 0 };
      },
      setStatus: async () => { await reload(); },
      addNote: async () => { await reload(); },
      saveDraft: async () => { await reload(); },
      saveFeedback: async () => { await reload(); },
    };
  }, [ready, user, projects, prospects, events, drafts, feedback, community, rate, toasts, gh, toast, dismissToast, reload]);

  return <Ctx.Provider value={api_}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Workspace {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}

export function useScrollTop(dep: string) {
  const last = useRef(dep);
  useEffect(() => {
    if (last.current !== dep) {
      last.current = dep;
      window.scrollTo({ top: 0 });
    }
  }, [dep]);
}
