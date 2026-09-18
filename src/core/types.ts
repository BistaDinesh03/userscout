/* UserScout domain model */

export type ID = string;

export interface UserRecord {
  id: ID;
  username: string;
  passHash: string;
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

/* Project analysis */

export interface ProjectProfile {
  fullName: string;
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
  discoverable: boolean;
  createdAt: number;
  updatedAt: number;
  lastDiscoveryAt: number | null;
}

/* Discovery / evidence */

export type EvidenceKind = "issue" | "repo" | "contribution" | "profile";

/** Deterministic evidence strength tier. */
export type EvidenceStrength = "very_strong" | "strong" | "medium" | "weak";

/** Recency bucket derived from the evidence timestamp. */
export type RecencyLevel = "very_recent" | "recent" | "aging" | "old" | "unknown";

export interface Evidence {
  kind: EvidenceKind;
  text: string;
  url?: string;
  at?: number;
  /** Optional — populated by the scoring engine. */
  strength?: EvidenceStrength;
  /** Short human-readable reason this evidence matters. */
  relevanceReason?: string;
  /** Where it came from (issue, related repo, profile, etc.). */
  sourceType?: string;
  /** Deterministic deduplication fingerprint. */
  fingerprint?: string;
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

export type ContactChannelType = "github" | "linkedin" | "website" | "email" | "twitter";

export interface ContactChannel {
  type: ContactChannelType;
  value: string;
  url?: string;
  source: string;
  verified: boolean;
  available: boolean;
}

export interface CautionSignal {
  type: "no_recent_activity" | "weak_evidence" | "old_evidence" | "tech_only" | "duplicate_evidence";
  message: string;
}

export interface ProspectContext {
  mainRole?: string;
  relevantRepos: string[];
  languages: string[];
  technologies: string[];
  recentActivity?: string;
}

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
  sources: string[];
  firstSeenAt: number;
  status: ProspectStatus;
  contactedAt: number | null;
  contactChannel: string | null;
  repliedAt: number | null;
  convertedAt: number | null;
  archived: boolean;
  contactChannels: ContactChannel[];
  context: ProspectContext;
  cautionSignals: CautionSignal[];
  lastActivityAt: number | null;
  recommendedAction: string;
  /* Evidence intelligence dimensions (Phase 1) */
  evidenceStrength: EvidenceStrength | null;
  recencyLevel: RecencyLevel | null;
  contactabilityLevel: "none" | "low" | "medium" | "high" | null;
  confidenceLevel: Confidence | null;
  whyThisPerson: string;
  whyNow: string;
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
  rating: number;
  useful: string;
  confusing: string;
  improve: string;
  wouldUseAgain: "yes" | "no" | "maybe";
  notes: string;
  at: number;
}

/* Discovery runtime */

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
  contactChannels: ContactChannel[];
  company?: string;
  location?: string;
  twitterUsername?: string;
  websiteUrl?: string;
}

export interface ScoredCandidate {
  candidate: DiscoveryCandidate;
  score: number;
  confidence: Confidence;
  signals: Signal[];
  explanation: string;
  /* New dimensions (Phase 1) */
  evidenceStrength: EvidenceStrength;
  recencyLevel: RecencyLevel;
  cautionSignals: CautionSignal[];
  whyThisPerson: string;
  whyNow: string;
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
