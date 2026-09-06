/* API client — talks to FastAPI backend instead of localStorage. */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch {
      // Ignore parse errors
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

function mapProject(p: any): any {
  return {
    id: p.id,
    ownerId: p.owner_id,
    profile: {
      fullName: p.full_name,
      owner: p.full_name ? p.full_name.split("/")[0] : "",
      repo: p.full_name ? p.full_name.split("/")[1] : "",
      url: p.url,
      description: p.description || "",
      homepage: p.homepage || "",
      primaryLanguage: p.primary_language || "",
      languages: p.languages || {},
      topics: p.topics || [],
      stars: p.stars || 0,
      forks: p.forks || 0,
      openIssues: p.open_issues || 0,
      license: p.license || "",
      readmeExcerpt: p.readme_excerpt || "",
      keywords: p.keywords || [],
      problemSpace: p.problem_space || [],
      audience: p.audience || [],
      queryTerms: p.query_terms || [],
      fetchedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    },
    discoverable: p.discoverable || false,
    createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
    lastDiscoveryAt: p.last_discovery_at ? new Date(p.last_discovery_at).getTime() : null,
  };
}

function mapProspect(p: any): any {
  return {
    id: p.id,
    projectId: p.project_id,
    ownerId: p.owner_id,
    login: p.login,
    name: p.name || "",
    avatarUrl: p.avatar_url || "",
    htmlUrl: p.html_url || "",
    bio: p.bio || "",
    signals: p.signals || [],
    score: p.score || 0,
    confidence: p.confidence || "low",
    explanation: p.explanation || "",
    sources: p.sources || [],
    firstSeenAt: p.first_seen_at ? new Date(p.first_seen_at).getTime() : Date.now(),
    status: p.status || "saved",
    contactedAt: p.contacted_at ? new Date(p.contacted_at).getTime() : null,
    contactChannel: p.contact_channel || null,
    repliedAt: p.replied_at ? new Date(p.replied_at).getTime() : null,
    convertedAt: p.converted_at ? new Date(p.converted_at).getTime() : null,
    archived: p.archived || false,
    contactChannels: p.contact_channels || [],
    context: p.context || {},
    cautionSignals: p.caution_signals || [],
    lastActivityAt: p.last_activity_at ? new Date(p.last_activity_at).getTime() : null,
    recommendedAction: p.recommended_action || "",
  };
}

export const api = {
  // Auth
  register: (username: string, password: string) =>
    request("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () =>
    request("/api/auth/logout", { method: "POST" }),
  me: () =>
    request("/api/auth/me"),

  // Projects
  listProjects: async () => {
    const r = await request<any>("/api/projects");
    return { projects: (r.projects || []).map(mapProject) };
  },
  createProject: async (profile: any) => {
    const r = await request<any>("/api/projects", { method: "POST", body: JSON.stringify({ profile }) });
    return { project: mapProject(r.project) };
  },

  // Prospects
  listProspects: async () => {
    const r = await request<any>("/api/prospects");
    return { prospects: (r.prospects || []).map(mapProspect) };
  },
  createProspect: async (prospect: any) => {
    const r = await request<any>("/api/prospects", { method: "POST", body: JSON.stringify(prospect) });
    return { prospect: mapProspect(r.prospect) };
  },

  // Health
  health: () =>
    request("/api/health"),
};
