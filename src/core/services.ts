/* ── Business logic / services ──────────────────────────────────────────
 * All mutations and ownership checks live here — never in route handlers
 * or components. Every read/write of a private resource verifies
 * resource.ownerId === actorId (IDOR protection). Throws AppError with
 * stable codes the UI maps to friendly states.
 */

import type {
  Draft,
  DraftChannel,
  FeedbackEntry,
  Prospect,
  ProspectStatus,
  Project,
  ProjectProfile,
  SafeUser,
  ScoredCandidate,
  SessionRecord,
  TimelineEvent,
  UserRecord,
} from "./types";
import { statusLabel } from "./types";
import type { StorageAdapter } from "./storage";
import { AppError, hashPassword, randomSalt, uid, verifyPassword } from "./utils";

const SESSION_TTL = 30 * 86_400_000;

function assertOwner(resourceOwnerId: string, actorId: string, what: string) {
  if (resourceOwnerId !== actorId) {
    throw new AppError("forbidden", `You don't have access to that ${what}.`);
  }
}

/* ═══ Auth ═══════════════════════════════════════════════════════════ */

export class AuthService {
  constructor(private db: StorageAdapter) {}

  async register(usernameRaw: string, password: string): Promise<{ user: SafeUser; token: string }> {
    const username = usernameRaw.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
      throw new AppError("validation", "Username: 3–24 chars, letters, digits, '-' or '_'.");
    }
    if (password.length < 8) throw new AppError("validation", "Password must be at least 8 characters.");
    const users = this.db.read<UserRecord>("users");
    if (users.some((u) => u.username === username)) {
      throw new AppError("conflict", "That username is taken in this workspace.");
    }
    const salt = randomSalt();
    const passHash = await hashPassword(password, salt);
    const user: UserRecord = { id: uid(), username, passHash, salt, createdAt: Date.now() };
    this.db.write("users", [...users, user]);
    return { user: this.safe(user), token: this.createSession(user.id) };
  }

  async login(usernameRaw: string, password: string): Promise<{ user: SafeUser; token: string }> {
    const username = usernameRaw.trim().toLowerCase();
    const user = this.db.read<UserRecord>("users").find((u) => u.username === username);
    if (!user) throw new AppError("unauthorized", "Invalid username or password.");
    const ok = await verifyPassword(password, user.salt, user.passHash);
    if (!ok) throw new AppError("unauthorized", "Invalid username or password.");
    return { user: this.safe(user), token: this.createSession(user.id) };
  }

  restore(token: string | null): SafeUser | null {
    if (!token) return null;
    const sessions = this.db.read<SessionRecord>("sessions").filter((s) => s.expiresAt > Date.now());
    this.db.write("sessions", sessions); // prune expired
    const s = sessions.find((x) => x.token === token);
    if (!s) return null;
    const user = this.db.read<UserRecord>("users").find((u) => u.id === s.userId);
    return user ? this.safe(user) : null;
  }

  logout(token: string | null) {
    if (!token) return;
    this.db.write(
      "sessions",
      this.db.read<SessionRecord>("sessions").filter((s) => s.token !== token),
    );
  }

  usernameOf(userId: string): string {
    return this.db.read<UserRecord>("users").find((u) => u.id === userId)?.username ?? "unknown";
  }

  private safe(u: UserRecord): SafeUser {
    return { id: u.id, username: u.username, createdAt: u.createdAt };
  }
  private createSession(userId: string): string {
    const token = uid() + uid();
    const s: SessionRecord = { token, userId, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL };
    this.db.write("sessions", [...this.db.read<SessionRecord>("sessions"), s]);
    return token;
  }
}

/* ═══ Projects ═══════════════════════════════════════════════════════ */

export class ProjectService {
  constructor(private db: StorageAdapter) {}

  create(ownerId: string, profile: ProjectProfile): Project {
    const all = this.db.read<Project>("projects");
    const dup = all.find((p) => p.ownerId === ownerId && p.profile.fullName.toLowerCase() === profile.fullName.toLowerCase());
    if (dup) throw new AppError("conflict", dup.id); // message carries the existing project id
    const now = Date.now();
    const project: Project = { id: uid(), ownerId, profile, discoverable: false, createdAt: now, updatedAt: now, lastDiscoveryAt: null };
    this.db.write("projects", [...all, project]);
    return project;
  }

  list(ownerId: string): Project[] {
    return this.db.read<Project>("projects").filter((p) => p.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt);
  }

  get(actorId: string, id: string): Project {
    const p = this.db.read<Project>("projects").find((x) => x.id === id);
    if (!p) throw new AppError("not_found", "Project not found.");
    assertOwner(p.ownerId, actorId, "project");
    return p;
  }

  update(actorId: string, id: string, patch: Partial<Pick<Project, "discoverable" | "lastDiscoveryAt">>): Project {
    const all = this.db.read<Project>("projects");
    const p = all.find((x) => x.id === id);
    if (!p) throw new AppError("not_found", "Project not found.");
    assertOwner(p.ownerId, actorId, "project");
    const next = { ...p, ...patch, updatedAt: Date.now() };
    this.db.write("projects", all.map((x) => (x.id === id ? next : x)));
    return next;
  }

  remove(actorId: string, id: string) {
    const projects = this.db.read<Project>("projects");
    const p = projects.find((x) => x.id === id);
    if (!p) throw new AppError("not_found", "Project not found.");
    assertOwner(p.ownerId, actorId, "project");
    this.db.write("projects", projects.filter((x) => x.id !== id));
    // cascade private data
    this.db.write("prospects", this.db.read<Prospect>("prospects").filter((x) => x.projectId !== id));
    this.db.write("events", this.db.read<TimelineEvent>("events").filter((x) => x.projectId !== id));
    this.db.write("feedback", this.db.read<FeedbackEntry>("feedback").filter((x) => x.projectId !== id));
    const prospectIds = new Set(this.db.read<Prospect>("prospects").map((x) => x.id));
    this.db.write("drafts", this.db.read<Draft>("drafts").filter((x) => prospectIds.has(x.prospectId)));
  }
}

/* ═══ Prospects ══════════════════════════════════════════════════════ */

export class ProspectService {
  constructor(private db: StorageAdapter) {}

  saveResults(
    actorId: string,
    projectId: string,
    scored: ScoredCandidate[],
  ): { prospects: Prospect[]; events: TimelineEvent[]; created: number; updated: number } {
    const projects = this.db.read<Project>("projects");
    const project = projects.find((p) => p.id === projectId);
    if (!project) throw new AppError("not_found", "Project not found.");
    assertOwner(project.ownerId, actorId, "project");

    const all = this.db.read<Prospect>("prospects");
    const allEvents = this.db.read<TimelineEvent>("events");
    const newEvents: TimelineEvent[] = [];
    let created = 0;
    let updated = 0;
    const now = Date.now();

    for (const s of scored) {
      const existing = all.find(
        (p) => p.projectId === projectId && p.login.toLowerCase() === s.candidate.login.toLowerCase(),
      );
      if (existing) {
        existing.signals = s.signals;
        existing.score = s.score;
        existing.confidence = s.confidence;
        existing.explanation = s.explanation;
        existing.sources = [...new Set([...existing.sources, ...s.candidate.sources])];
        existing.name = s.candidate.name || existing.name;
        existing.bio = s.candidate.bio || existing.bio;
        existing.avatarUrl = s.candidate.avatarUrl || existing.avatarUrl;
        updated++;
      } else {
        const p: Prospect = {
          id: uid(),
          projectId,
          ownerId: actorId,
          login: s.candidate.login,
          name: s.candidate.name,
          avatarUrl: s.candidate.avatarUrl,
          htmlUrl: s.candidate.htmlUrl,
          bio: s.candidate.bio,
          signals: s.signals,
          score: s.score,
          confidence: s.confidence,
          explanation: s.explanation,
          sources: s.candidate.sources,
          firstSeenAt: now,
          status: "saved",
          contactedAt: null,
          contactChannel: null,
          repliedAt: null,
          convertedAt: null,
          archived: false,
        };
        all.push(p);
        newEvents.push(this.event(p, "created", `Saved from discovery — score ${s.score}/100 (${s.confidence} confidence).`));
        created++;
      }
    }

    // mark discovery run on project
    this.db.write(
      "projects",
      projects.map((p) => (p.id === projectId ? { ...p, lastDiscoveryAt: now, updatedAt: now } : p)),
    );
    this.db.write("prospects", all);
    this.db.write("events", [...allEvents, ...newEvents]);
    return { prospects: all, events: [...allEvents, ...newEvents], created, updated };
  }

  listByProject(actorId: string, projectId: string): Prospect[] {
    const project = this.db.read<Project>("projects").find((p) => p.id === projectId);
    if (!project) throw new AppError("not_found", "Project not found.");
    assertOwner(project.ownerId, actorId, "project");
    return this.db
      .read<Prospect>("prospects")
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => b.score - a.score);
  }

  get(actorId: string, prospectId: string): Prospect {
    const p = this.db.read<Prospect>("prospects").find((x) => x.id === prospectId);
    if (!p) throw new AppError("not_found", "Prospect not found.");
    assertOwner(p.ownerId, actorId, "prospect");
    return p;
  }

  setStatus(
    actorId: string,
    prospectId: string,
    to: ProspectStatus,
    opts: { channel?: string; note?: string } = {},
  ): { prospect: Prospect; events: TimelineEvent[] } {
    const all = this.db.read<Prospect>("prospects");
    const p = all.find((x) => x.id === prospectId);
    if (!p) throw new AppError("not_found", "Prospect not found.");
    assertOwner(p.ownerId, actorId, "prospect");
    const from = p.status;
    if (from === to) return { prospect: p, events: this.db.read<TimelineEvent>("events") };

    const now = Date.now();
    p.status = to;
    p.archived = to === "archived";
    if (to === "contacted") {
      p.contactedAt = now;
      p.contactChannel = opts.channel ?? p.contactChannel ?? "github";
    }
    if (to === "replied") p.repliedAt = now;
    if (to === "user") p.convertedAt = now;
    if (to !== "contacted" && to !== "replied" && to !== "tried" && to !== "feedback" && to !== "user") {
      p.contactedAt = null;
      p.contactChannel = null;
      p.repliedAt = null;
      p.convertedAt = null;
    } else if (to !== "replied" && to !== "tried" && to !== "feedback" && to !== "user") {
      p.repliedAt = null;
      p.convertedAt = null;
    } else if (to !== "tried" && to !== "feedback" && to !== "user") {
      p.convertedAt = null;
    }

    const ev = this.event(p, "status", opts.note || `Status: ${statusLabel(from)} → ${statusLabel(to)}`, { from, to, channel: opts.channel });
    const events = [...this.db.read<TimelineEvent>("events"), ev];
    this.db.write("prospects", all);
    this.db.write("events", events);
    return { prospect: { ...p }, events };
  }

  addNote(actorId: string, prospectId: string, text: string): TimelineEvent[] {
    const p = this.get(actorId, prospectId);
    const clean = text.trim();
    if (!clean) throw new AppError("validation", "Note is empty.");
    if (clean.length > 2000) throw new AppError("validation", "Notes are limited to 2000 characters.");
    const ev = this.event(p, "note", clean);
    const events = [...this.db.read<TimelineEvent>("events"), ev];
    this.db.write("events", events);
    return events;
  }

  eventsFor(actorId: string, prospectId: string): TimelineEvent[] {
    this.get(actorId, prospectId);
    return this.db
      .read<TimelineEvent>("events")
      .filter((e) => e.prospectId === prospectId)
      .sort((a, b) => a.at - b.at);
  }

  private event(p: Prospect, type: TimelineEvent["type"], message: string, extra: Partial<TimelineEvent> = {}): TimelineEvent {
    return { id: uid(), prospectId: p.id, projectId: p.projectId, ownerId: p.ownerId, type, message, at: Date.now(), ...extra };
  }
}

/* ═══ Drafts (outreach messages are composed, never sent) ════════════ */

export class DraftService {
  constructor(private db: StorageAdapter, private prospects: ProspectService) {}

  get(actorId: string, prospectId: string): Draft | null {
    this.prospects.get(actorId, prospectId);
    return this.db.read<Draft>("drafts").find((d) => d.prospectId === prospectId) ?? null;
  }

  upsert(actorId: string, prospectId: string, channel: DraftChannel, body: string): Draft[] {
    const p = this.prospects.get(actorId, prospectId);
    if (body.length > 5000) throw new AppError("validation", "Drafts are limited to 5000 characters.");
    const all = this.db.read<Draft>("drafts");
    const existing = all.find((d) => d.prospectId === prospectId);
    const draft: Draft = { prospectId, ownerId: p.ownerId, channel, body, updatedAt: Date.now() };
    const next = existing ? all.map((d) => (d.prospectId === prospectId ? draft : d)) : [...all, draft];
    this.db.write("drafts", next);
    return next;
  }
}

/* ═══ Feedback ═══════════════════════════════════════════════════════ */

export class FeedbackService {
  constructor(private db: StorageAdapter, private prospects: ProspectService) {}

  forProspect(actorId: string, prospectId: string): FeedbackEntry | null {
    this.prospects.get(actorId, prospectId);
    return this.db.read<FeedbackEntry>("feedback").find((f) => f.prospectId === prospectId) ?? null;
  }

  save(
    actorId: string,
    prospectId: string,
    input: { rating: number; useful: string; confusing: string; improve: string; wouldUseAgain: FeedbackEntry["wouldUseAgain"]; notes: string },
  ): { feedback: FeedbackEntry[]; events: TimelineEvent[]; prospect: Prospect } {
    const p = this.prospects.get(actorId, prospectId);
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new AppError("validation", "Rating must be between 1 and 5.");
    }
    const all = this.db.read<FeedbackEntry>("feedback");
    const existing = all.find((f) => f.prospectId === prospectId);
    const entry: FeedbackEntry = {
      id: existing?.id ?? uid(),
      prospectId,
      projectId: p.projectId,
      ownerId: actorId,
      ...input,
      at: Date.now(),
    };
    const feedback = existing ? all.map((f) => (f.prospectId === prospectId ? entry : f)) : [...all, entry];
    this.db.write("feedback", feedback);

    // Persist the feedback event first so a subsequent status transition
    // (which re-reads events) can never drop it.
    const ev: TimelineEvent = {
      id: uid(),
      prospectId,
      projectId: p.projectId,
      ownerId: actorId,
      type: "feedback",
      message: `Feedback logged: ${"★".repeat(input.rating)}${"☆".repeat(5 - input.rating)} · would use again: ${input.wouldUseAgain}`,
      at: Date.now(),
    };
    this.db.write("events", [...this.db.read<TimelineEvent>("events"), ev]);

    let events = this.db.read<TimelineEvent>("events");
    let prospect = p;
    if (["saved", "contacted", "replied", "tried"].includes(p.status)) {
      const r = this.prospects.setStatus(actorId, prospectId, "feedback", { note: `Status: ${statusLabel(p.status)} → Feedback received (after feedback logged)` });
      events = r.events;
      prospect = r.prospect;
    }
    return { feedback, events, prospect };
  }
}

/* ═══ Funnel metrics — computed from real rows only ══════════════════ */

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  rate: number | null; // vs previous stage, null when denominator is 0
}

const FUNNEL_ORDER: ProspectStatus[] = ["saved", "contacted", "replied", "tried", "feedback", "user"];

export function computeFunnel(prospects: Prospect[]): { stages: FunnelStage[]; notInterested: number; archived: number } {
  const active = prospects.filter((p) => !p.archived && p.status !== "not_interested");
  const idx = (s: ProspectStatus) => FUNNEL_ORDER.indexOf(s);
  const atLeast = (stage: ProspectStatus) =>
    active.filter((p) => {
      const i = idx(p.status);
      return i >= 0 && i >= idx(stage);
    }).length;

  const stages: FunnelStage[] = FUNNEL_ORDER.map((s, i) => {
    const count = atLeast(s);
    const prev = i === 0 ? count : atLeast(FUNNEL_ORDER[i - 1]);
    return { id: s, label: statusLabel(s), count, rate: i === 0 ? null : prev > 0 ? count / prev : null };
  });
  return {
    stages,
    notInterested: prospects.filter((p) => p.status === "not_interested").length,
    archived: prospects.filter((p) => p.archived).length,
  };
}

/* ═══ Community index (opt-in, public repo data + usernames only) ════ */

export interface CommunityListing {
  project: Project;
  ownerUsername: string;
  prospectCount: number;
  userCount: number;
  mine: boolean;
}

export function listDiscoverable(db: StorageAdapter, actorId: string | null): CommunityListing[] {
  const projects = db.read<Project>("projects").filter((p) => p.discoverable);
  const prospects = db.read<Prospect>("prospects");
  const users = db.read<UserRecord>("users");
  return projects
    .map((project) => ({
      project,
      ownerUsername: users.find((u) => u.id === project.ownerId)?.username ?? "unknown",
      prospectCount: prospects.filter((x) => x.projectId === project.id && !x.archived).length,
      userCount: prospects.filter((x) => x.projectId === project.id && x.status === "user").length,
      mine: project.ownerId === actorId,
    }))
    .sort((a, b) => b.project.profile.stars - a.project.profile.stars);
}
