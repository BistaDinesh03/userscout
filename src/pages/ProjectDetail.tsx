/* Project overview — profile, funnel (real data only), saved prospects. */

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { computeFunnel } from "../core/services";
import { useWorkspace } from "../state/store";
import type { ProspectStatus } from "../core/types";
import { STATUSES } from "../core/types";
import { PageHead } from "../components/layout";
import { Avatar, Chip, FunnelViz, ScoreDial } from "../components/bits";
import { IAlert, IArrowL, IArrowR, IExt, IFork, IIssue, IRadar, ISearch, IStar, IUsers } from "../components/icons";
import { Badge, Button, ConfidenceBadge, EmptyState, StatusPill, Tabs, Toggle } from "../components/ui";
import { cx, formatNumber, timeAgo } from "../core/utils";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { projects, prospects, setDiscoverable, toast } = useWorkspace();
  const nav = useNavigate();
  const [tab, setTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");

  const project = projects.find((p) => p.id === id);
  const pros = useMemo(() => prospects.filter((p) => p.projectId === id), [prospects, id]);
  const funnel = useMemo(() => computeFunnel(pros), [pros]);
  const filtered = pros.filter((p) => (statusFilter === "all" ? !p.archived : p.status === statusFilter));

  if (!project) {
    return (
      <EmptyState
        icon={<IAlert size={20} />}
        title="Project not found"
        body="It may have been deleted, or it belongs to another account on this device."
        action={<Link to="/app/projects"><Button><IArrowL size={13} /> Back to projects</Button></Link>}
      />
    );
  }

  const pf = project.profile;

  return (
    <>
      <PageHead
        title={pf.fullName}
        sub={pf.description || "No description on the repository."}
        right={
          <>
            <a href={pf.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><IExt size={13} /> GitHub</Button>
            </a>
            <Button size="sm" onClick={() => nav(`/app/projects/${project.id}/discovery`)}>
              <IRadar size={13} /> Run discovery
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fog-400">
        {pf.primaryLanguage && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-signal-400" />{pf.primaryLanguage}</span>}
        <span className="flex items-center gap-1.5"><IStar size={13} className="text-fog-500" />{formatNumber(pf.stars)} stars</span>
        <span className="flex items-center gap-1.5"><IFork size={13} className="text-fog-500" />{formatNumber(pf.forks)} forks</span>
        <span className="flex items-center gap-1.5"><IIssue size={13} className="text-fog-500" />{formatNumber(pf.openIssues)} open issues</span>
        {pf.license && <Badge tone="pine" className="font-mono">{pf.license}</Badge>}
        <span className="ml-auto"><Toggle checked={project.discoverable} onChange={(v) => { setDiscoverable(project.id, v); toast("ok", v ? "Listed in the local community index." : "Removed from the community index."); }} label="List in community" /></span>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "prospects", label: "Saved prospects", count: pros.filter((p) => !p.archived).length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-5">
            <Panel title="Likely audience" kicker="derived from description · topics · readme">
              <ul className="space-y-2">
                {pf.audience.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-[13.5px] text-fog-200">
                    <span className="mt-[7px] size-1.5 rounded-full bg-signal-400" />{a}
                  </li>
                ))}
                {!pf.audience.length && <li className="text-[13px] text-fog-500">Not enough signal to derive an audience.</li>}
              </ul>
            </Panel>
            <Panel title="Problem space" kicker="what discovery queries are built from">
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-fog-300">
                {pf.problemSpace.map((s) => <li key={s}>· {s}</li>)}
              </ul>
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {pf.queryTerms.map((t) => <Badge key={t} tone="amber" className="font-mono">“{t}”</Badge>)}
              </div>
            </Panel>
            <Panel title="Repository fingerprint" kicker="topics & keywords">
              <div className="flex flex-wrap gap-1.5">
                {pf.topics.map((t) => <Chip key={t}>{t}</Chip>)}
                {pf.keywords.filter((k) => !pf.topics.includes(k)).map((k) => <Chip key={k}>{k}</Chip>)}
              </div>
              {pf.readmeExcerpt && (
                <p className="mt-3.5 rounded-md border border-pine-700 bg-pine-950/50 p-3 font-mono text-[11px] leading-relaxed text-fog-500">
                  {pf.readmeExcerpt.slice(0, 260)}{pf.readmeExcerpt.length > 260 ? "…" : ""}
                </p>
              )}
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel title="Conversion funnel" kicker="computed from your records — never estimated">
              {pros.length === 0 ? (
                <div className="rounded-md border border-dashed border-pine-600 px-4 py-6 text-center">
                  <p className="text-[12.5px] text-fog-500">No prospects saved yet — metrics appear once you do.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => nav(`/app/projects/${project.id}/discovery`)}>
                    <ISearch size={13} /> Run first discovery
                  </Button>
                </div>
              ) : (
                <>
                  <FunnelViz stages={funnel.stages} />
                  <div className="mt-3.5 flex items-center justify-between border-t border-pine-700 pt-3 text-[11.5px] text-fog-500">
                    <span>not interested: {funnel.notInterested}</span>
                    <span>archived: {funnel.archived}</span>
                    {funnel.stages[5].count > 0 && funnel.stages[0].count > 0 && (
                      <Badge tone="green" className="font-mono">{Math.round((funnel.stages[5].count / funnel.stages[0].count) * 100)}% overall</Badge>
                    )}
                  </div>
                </>
              )}
            </Panel>
            <Panel title="Best current match" kicker="highest saved score">
              {pros[0] ? (
                <Link to={`/app/prospects/${pros[0].id}`} className="group flex items-center gap-4 rounded-md border border-pine-700 bg-pine-950/50 p-3.5 transition-colors hover:border-signal-500/50">
                  <ScoreDial score={pros[0].score} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Avatar url={pros[0].avatarUrl} login={pros[0].login} size={22} />
                      <span className="truncate text-[14px] font-semibold text-fog-100 group-hover:text-signal-300">@{pros[0].login}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fog-400">{pros[0].explanation}</p>
                  </div>
                  <IArrowR size={15} className="shrink-0 text-fog-500 group-hover:text-signal-400" />
                </Link>
              ) : (
                <p className="text-[12.5px] text-fog-500">Nothing saved yet.</p>
              )}
            </Panel>
            <div className="rounded-md border border-pine-700/70 bg-pine-900/50 px-4 py-3 font-mono text-[10.5px] leading-relaxed text-fog-500">
              last discovery: {project.lastDiscoveryAt ? timeAgo(project.lastDiscoveryAt) : "never"} · added {timeAgo(project.createdAt)}
            </div>
          </div>
        </div>
      )}

      {tab === "prospects" && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label={`All · ${pros.filter((p) => !p.archived).length}`} />
            {STATUSES.map((s) => {
              const n = pros.filter((p) => p.status === s.id).length;
              if (!n) return null;
              return <FilterChip key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)} label={`${s.label} · ${n}`} />;
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<IUsers size={20} />}
              title={pros.length === 0 ? "No prospects saved" : "Nothing in this status"}
              body={pros.length === 0 ? "Run discovery to find people with public evidence they need this project — then save the ones worth writing to." : "Switch filters or move prospects along the pipeline from their detail page."}
              action={pros.length === 0 ? <Button onClick={() => nav(`/app/projects/${project.id}/discovery`)}><IRadar size={14} /> Run discovery</Button> : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {filtered.map((p) => (
                <li key={p.id}>
                  <Link to={`/app/prospects/${p.id}`} className="group flex items-center gap-4 rounded-md border border-pine-700/80 bg-pine-900/60 px-4 py-3 transition-all hover:border-signal-500/40 hover:bg-pine-900">
                    <Avatar url={p.avatarUrl} login={p.login} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-fog-100 group-hover:text-signal-300">@{p.login}</span>
                        <ConfidenceBadge c={p.confidence} />
                        <StatusPill status={p.status} />
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-fog-500">{p.explanation}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="font-display text-[18px] font-bold text-fog-100">{p.score}<span className="text-[11px] text-fog-500">/100</span></div>
                      <div className="font-mono text-[9.5px] uppercase tracking-wider text-fog-500">{p.confidence} relevance</div>
                    </div>
                    <IArrowR size={14} className="shrink-0 text-fog-600 group-hover:text-signal-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function Panel({ title, kicker, children }: { title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold text-fog-100">{title}</h2>
        {kicker && <span className="font-mono text-[9.5px] uppercase tracking-wider text-fog-500">{kicker}</span>}
      </div>
      {children}
    </section>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cx("rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors", active ? "border-signal-500/60 bg-signal-500/12 text-signal-300" : "border-pine-600 text-fog-400 hover:text-fog-100")}>
      {label}
    </button>
  );
}
