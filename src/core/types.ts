/* ── UserScout domain model ─────────────────────────────────────────────
 * Pure domain types shared by storage, services, and the UI.
 * No personal data beyond what is already public on GitHub is modeled.
 */

export type ID = string;

export interface UserRecord {
  id: ID;
  username: string;
  passHash: string; // PBKDF2-SHA256, never plaintext
  salt: string;
  createdAt: number;
}

export type SafeUser = Pick<UserRecord, "id" | "username" | "createdAt">;

export interface SessionRecord {
  token: string;
  userId: ID;
  createdAt: number;
  expiresAt: number;
}

/* ── Project analysis ── */

export interface ProjectProfile {
  fullName: string; // owner/repo
  owner: string;
  repo: string;
  url: string;
  description: string;
  homepage: string;
  primaryLanguage: string;
  languages: Record<string, number>;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  license: string;
  readmeExcerpt: string;
  /* derived (deterministic heuristics, documented in README) */
  keywords: string[];
  problemSpace: string[];
  audience: string[];
  queryTerms: string[];
  fetchedAt: number;
}

export interface Project {
  id: ID;
  ownerId: ID;
  profile: ProjectProfile;
  discoverable: boolean; // opt-in to the local community index
  createdAt: number;
  updatedAt: number;
  lastDiscoveryAt: number | null;
}

/* ── Discovery / evidence ── */

export type EvidenceKind = "issue" | "repo" | "contribution" | "profile";

export interface Evidence {
  kind: EvidenceKind;
  text: string;
  url?: string;
  at?: number; // when the activity happened (epoch ms)
}

export type SignalId =
  | "asking"
  | "maintainer"
  | "contributor"
  | "tech"
  | "recency"
  | "audience";

export interface Signal {
  id: SignalId;
  label: string;
  points: number;
  maxPoints: number;
  evidence: Evidence[];
}

export type Confidence = "low" | "medium" | "high";

export type ProspectStatus =
  | "saved"
  | "contacted"
  | "replied"
  | "tried"
  | "feedback"
  | "user"
  | "not_interested"
  | "archived";

export interface Prospect {
  id: ID;
  projectId: ID;
  ownerId: ID;
  login: string;
  name: string;
  avatarUrl: string;
  htmlUrl: string;
  bio: string;
  signals: Signal[];
  score: number;
  confidence: Confidence;
  explanation: string;
  sources: string[]; // discovery queries that surfaced this person
  firstSeenAt: number;
  status: ProspectStatus;
  contactedAt: number | null;
  contactChannel: string | null;
  repliedAt: number | null;
  convertedAt: number | null;
  archived: boolean;
}

export type TimelineType = "created" | "status" | "note" | "draft" | "feedback";

export interface TimelineEvent {
  id: ID;
  prospectId: ID;
  projectId: ID;
  ownerId: ID;
  type: TimelineType;
  message: string;
  from?: ProspectStatus;
  to?: ProspectStatus;
  channel?: string;
  at: number;
}

export type DraftChannel = "email" | "github" | "chat" | "other";

export interface Draft {
  prospectId: ID;
  ownerId: ID;
  channel: DraftChannel;
  body: string;
  updatedAt: number;
}

export interface FeedbackEntry {
  id: ID;
  prospectId: ID;
  projectId: ID;
  ownerId: ID;
  rating: number; // 1..5
  useful: string;
  confusing: string;
  improve: string;
  wouldUseAgain: "yes" | "no" | "maybe";
  notes: string;
  at: number;
}

/* ── Discovery runtime ── */

export interface DiscoveryCandidate {
  login: string;
  name: string;
  avatarUrl: string;
  htmlUrl: string;
  bio: string;
  evidences: Evidence[];
  sources: string[];
  relatedRepos: string[];
  matchedTerms: string[];
  lastActivityAt: number;
  askingTitles: string[];
  isAsking: boolean;
  languages: string[];
  repoTopics: string[];
}

export interface ScoredCandidate {
  candidate: DiscoveryCandidate;
  score: number;
  confidence: Confidence;
  signals: Signal[];
  explanation: string;
}

export interface RateInfo {
  coreRemaining: number | null;
  coreReset: number | null;
  searchRemaining: number | null;
  searchReset: number | null;
}

export interface AnalysisProgress {
  phase: "validate" | "repo" | "readme" | "derive";
  message: string;
  done: boolean;
}

export interface DiscoveryStep {
  id: string;
  label: string;
  kind: "issues" | "repos" | "contributors" | "profiles";
  detail: string;
}

export interface DiscoveryProgress {
  stepId: string;
  message: string;
  status: "run" | "ok" | "warn" | "err";
  count?: number;
}

export const STATUSES: { id: ProspectStatus; label: string }[] = [
  { id: "saved", label: "Saved" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "tried", label: "Tried project" },
  { id: "feedback", label: "Feedback received" },
  { id: "user", label: "Became user" },
  { id: "not_interested", label: "Not interested" },
  { id: "archived", label: "Archived" },
];

export const statusLabel = (s: ProspectStatus) =>
  STATUSES.find((x) => x.id === s)?.label ?? s;
