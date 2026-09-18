/* Home — the post-login action workspace.
 * New users see a compact 3-step onboarding.
 * Existing users see real stats + the next action items. */

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar } from "../components/bits";
import { IPlus, IRadar, IArrowR, IInbox, IUsers, ICheck, ICompass } from "../components/icons";
import { Badge, Button, StatusPill } from "../components/ui";
import { timeAgo } from "../core/utils";

export default function Home() {
  const { user, projects, prospects } = useWorkspace();
  const nav = useNavigate();

  const stats = useMemo(() => {
    const active = prospects.filter((p) => !p.archived && p.status !== "not_interested");
    return {
      projects: projects.length,
      prospects: active.length,
      contacted: active.filter((p) => ["contacted", "replied", "tried", "feedback", "user"].includes(p.status)).length,
      replied: active.filter((p) => ["replied", "tried", "feedback", "user"].includes(p.status)).length,
      users: prospects.filter((p) => p.status === "user").length,
    };
  }, [projects, prospects]);

  // Which onboarding step is the user on? Derived from real data, no persisted flag.
  const onboardingStep = useMemo<"empty" | "needs_discovery" | "needs_outreach" | "done">(() => {
    if (projects.length === 0) return "empty";
    const hasAnyProspect = prospects.some((p) => !p.archived);
    if (!hasAnyProspect) return "needs_discovery";
    const hasContacted = prospects.some((p) =>
      ["contacted", "replied", "tried", "feedback", "user"].includes(p.status)
    );
    if (!hasContacted) return "needs_outreach";
    return "done";
  }, [projects, prospects]);

  // The single project the user should scout next (most recently created).
  const primaryProject = useMemo(() => {
    return [...projects].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }, [projects]);

  // Next actions: real prospects that need attention, sorted deterministically.
  const nextActions = useMemo(() => {
    const uncontacted = prospects.filter((p) => !p.archived && p.status === "saved");
    return [...uncontacted]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
      })
      .slice(0, 4);
  }, [prospects]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.profile.fullName ?? "—";

  /* ── New-user onboarding ── */
  if (onboardingStep === "empty") {
    return (
      <>
        <PageHead
          title={`Welcome${user ? `, @${user.username}` : ""}`}
          sub="Find people already experiencing the problems your project solves."
        />

        <section className="mb-8 rounded-lg border border-pine-700/80 bg-pine-900/60 p-6">
          <div className="flex items-start gap-4">
            <span className="shrink-0 rounded-md border border-pine-600 bg-pine-800/70 p-2.5 text-signal-400">
              <IRadar size={22} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[18px] font-bold text-fog-100">Start with your project</h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-fog-400">
                Add a public GitHub repository. UserScout analyzes what it does, derives who it's for,
                then finds people with public evidence connected to the problem it solves.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => nav("/app/projects/new")}>
                  <IPlus size={14} /> Add your first project
                </Button>
                <Link to="/app/community">
                  <Button variant="ghost">Browse community projects</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h2 className="mb-3 font-display text-[15px] font-bold text-fog-100">How UserScout works</h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            <Step n="01" title="Add your project" body="Tell UserScout what you built. It reads the public repo and derives the problem space." />
            <Step n="02" title="Discover opportunities" body="Find people with public evidence connected to the problem you solve." />
            <Step n="03" title="Start conversations" body="Review the evidence and reach out personally — you write every message." />
          </ol>
        </section>

        <p className="mt-6 text-center font-mono text-[10.5px] text-fog-600">
          quality &gt; quantity · no mass outreach · public evidence only
        </p>
      </>
    );
  }

  /* ── Existing workspace ── */
  return (
    <>
      <PageHead
        title={`Welcome back${user ? `, @${user.username}` : ""}`}
        sub="Your workspace at a glance, and the next people worth reviewing."
        right={
          <Button onClick={() => nav("/app/projects/new")}>
            <IPlus size={14} /> Add project
          </Button>
        }
      />

      {/* Progressive onboarding: still early in the loop */}
      {onboardingStep === "needs_discovery" && primaryProject && (
        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-signal-500/40 bg-signal-500/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-signal-400">Next step</div>
            <div className="mt-0.5 font-display text-[15px] font-bold text-fog-100">
              Project added. Find people with public evidence connected to the problem it solves.
            </div>
            <p className="mt-1 text-[12.5px] text-fog-400">
              UserScout will search public GitHub activity for people who already show signals related to {primaryProject.profile.fullName}.
            </p>
          </div>
          <Button onClick={() => nav(`/app/projects/${primaryProject.id}/discovery`)}>
            <IRadar size={14} /> Start discovery
          </Button>
        </section>
      )}

      {onboardingStep === "needs_outreach" && (
        <section className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-signal-500/40 bg-signal-500/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-signal-400">Next step</div>
            <div className="mt-0.5 font-display text-[15px] font-bold text-fog-100">
              You're ready for outreach.
            </div>
            <p className="mt-1 text-[12.5px] text-fog-400">
              Review the evidence on your strongest prospects, write your message, and contact them yourself. Nothing is sent automatically.
            </p>
          </div>
          <Button onClick={() => nav("/app/outreach")}>
            <IInbox size={14} /> Review outreach
          </Button>
        </section>
      )}

      {/* Stat strip */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatTile label="Projects" value={stats.projects} onClick={() => nav("/app/projects")} />
        <StatTile label="Prospects" value={stats.prospects} onClick={() => nav("/app/outreach")} />
        <StatTile label="Contacted" value={stats.contacted} onClick={() => nav("/app/outreach")} />
        <StatTile label="Replied" value={stats.replied} onClick={() => nav("/app/outreach")} />
        <StatTile label="Became users" value={stats.users} accent onClick={() => nav("/app/outreach")} />
      </div>

      {/* Next actions */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[16px] font-bold text-fog-100">Next to review</h2>
          <Link to="/app/outreach" className="font-mono text-[11px] uppercase tracking-wider text-fog-500 hover:text-signal-300">
            View outreach →
          </Link>
        </div>

        {nextActions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-pine-600 bg-pine-900/40 px-5 py-8 text-center">
            <p className="text-[13px] text-fog-300">No uncontacted prospects right now.</p>
            <p className="mt-1 text-[12px] text-fog-500">
              Run discovery on a project to find people with public evidence connected to your problem.
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => nav("/app/projects")}>
                <IRadar size={13} /> Go to projects
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {nextActions.map((p) => (
              <li key={p.id}>
                <article className="flex h-full flex-col rounded-lg border border-pine-700/80 bg-pine-900/60 p-4 transition-colors hover:border-signal-500/50">
                  <header className="flex items-start gap-3">
                    <Avatar url={p.avatarUrl} login={p.login} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[14px] font-semibold text-fog-100">@{p.login}</span>
                        {p.name && <span className="text-[12px] text-fog-400">{p.name}</span>}
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-fog-500">{projectName(p.projectId)}</div>
                    </div>
                    <StatusPill status={p.status} />
                  </header>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-wider text-fog-500">
                    <span><span className="text-fog-200">{p.score}</span> relevance</span>
                    <span aria-hidden="true">·</span>
                    <span>{(p.evidenceStrength ?? p.confidence ?? "unknown").replace("_", " ")} evidence</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-fog-300">
                    {p.whyThisPerson || p.explanation}
                  </p>
                  <div className="mt-auto pt-4">
                    <Button size="sm" variant="outline" onClick={() => nav(`/app/prospects/${p.id}`)} className="w-full">
                      Review prospect <IArrowR size={12} />
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-[15px] font-bold text-fog-100">Your projects</h2>
        <ul className="space-y-2">
          {projects.slice(0, 4).map((p) => {
            const pros = prospects.filter((x) => x.projectId === p.id && !x.archived);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border border-pine-700/70 bg-pine-900/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/app/projects/${p.id}`} className="truncate font-display text-[14px] font-bold text-fog-100 hover:text-signal-300">
                    {p.profile.fullName}
                  </Link>
                  <div className="mt-0.5 text-[11.5px] text-fog-500">
                    {pros.length} prospect{pros.length === 1 ? "" : "s"} · {p.lastDiscoveryAt ? `discovered ${timeAgo(p.lastDiscoveryAt)}` : "not discovered yet"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => nav(`/app/projects/${p.id}/discovery`)}>
                    <IRadar size={12} /> Discover
                  </Button>
                  <Link to={`/app/projects/${p.id}`}>
                    <Button size="sm" variant="ghost" aria-label={`Open ${p.profile.fullName}`}>
                      <IArrowR size={13} />
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function StatTile({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  const cls = "rounded-md border border-pine-700/70 bg-pine-900/50 px-3.5 py-3 text-left transition-colors hover:border-pine-600";
  const inner = (
    <>
      <div className={`font-display text-[20px] font-bold leading-none ${accent ? "text-signal-400" : "text-fog-100"}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-fog-500">{label}</div>
    </>
  );
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-lg border border-pine-700/70 bg-pine-900/40 p-4">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-signal-400">{n}</div>
      <div className="font-display text-[14px] font-bold text-fog-100">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-fog-400">{body}</p>
    </li>
  );
}
