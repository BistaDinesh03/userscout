/* Outreach workspace — next actions across all projects. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { computeFunnel } from "../core/services";
import type { ProspectStatus } from "../core/types";
import { STATUSES, statusLabel } from "../core/types";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, FunnelViz } from "../components/bits";
import { IArrowR, ICheck, IInbox, IRadar, ISend } from "../components/icons";
import { Badge, Button, EmptyState, StatusPill } from "../components/ui";
import { cx, timeAgo } from "../core/utils";

type Filter = ProspectStatus | "active" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "saved", label: "Needs contact" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "tried", label: "Tried" },
  { id: "feedback", label: "Feedback" },
  { id: "user", label: "Users" },
  { id: "not_interested", label: "Not interested" },
  { id: "archived", label: "Archived" },
];

export default function Outreach() {
  const { prospects, projects, setStatus, toast } = useWorkspace();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("active");

  const funnel = useMemo(() => computeFunnel(prospects), [prospects]);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.profile.fullName ?? "deleted project";

  const stats = useMemo(() => ({
    needsAttention: prospects.filter((p) => p.status === "saved" && !p.archived).length,
    contacted: prospects.filter((p) => ["contacted", "replied", "tried", "feedback", "user"].includes(p.status)).length,
    replied: prospects.filter((p) => ["replied", "tried", "feedback", "user"].includes(p.status)).length,
    tried: prospects.filter((p) => ["tried", "feedback", "user"].includes(p.status)).length,
    feedback: prospects.filter((p) => ["feedback", "user"].includes(p.status)).length,
    users: prospects.filter((p) => p.status === "user").length,
  }), [prospects]);

  const activeList = useMemo(
    () => prospects.filter((p) => !p.archived && p.status !== "not_interested"),
    [prospects],
  );

  const nextToContact = useMemo(() => {
    // Dedupe by (projectId, login) — same person, same project = one card
    const seen = new Map<string, typeof activeList[number]>();
    for (const p of activeList) {
      if (p.status !== "saved") continue;
      const key = `${p.projectId}::${p.login.toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing || (p.score > existing.score) || (p.score === existing.score && (p.lastActivityAt ?? 0) > (existing.lastActivityAt ?? 0))) {
        seen.set(key, p);
      }
    }
    return [...seen.values()]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
      })
      .slice(0, 5);
  }, [activeList]);

  const list = useMemo(() => {
    const base = prospects.filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return !p.archived && p.status !== "not_interested";
      return p.status === filter;
    });
    return base.sort((a, b) => b.score - a.score);
  }, [prospects, filter]);

  const emptyTitle = prospects.length === 0
    ? "Pipeline is empty"
    : filter === "active"
      ? "Nothing active right now"
      : `Nothing in "${filter === "all" ? "All" : statusLabel(filter as ProspectStatus)}"`;

  const emptyBody = prospects.length === 0
    ? "Save prospects from a discovery run first, then decide who to contact. Quality over quantity — only people with evidence belong here."
    : "People move through this pipeline from their detail page.";

  return (
    <>
      <PageHead
        title="Outreach"
        sub="Turn your strongest opportunities into thoughtful conversations."
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Needs attention" value={stats.needsAttention} accent={stats.needsAttention > 0} />
        <StatTile label="Contacted" value={stats.contacted} />
        <StatTile label="Replied" value={stats.replied} />
        <StatTile label="Tried" value={stats.tried} />
        <StatTile label="Feedback" value={stats.feedback} />
        <StatTile label="Users" value={stats.users} />
      </div>

      {/* Next to contact */}
      {nextToContact.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-[16px] font-bold text-fog-100">Next to contact</h2>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-fog-500">
              {nextToContact.length} {nextToContact.length === 1 ? "prospect" : "prospects"}
            </span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nextToContact.map((p) => (
              <li key={p.id}>
                <NextCard
                  prospect={p}
                  onOpen={() => nav(`/app/prospects/${p.id}`)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* All outreach heading + filters */}
      <div className="mb-3 mt-2 flex items-baseline justify-between">
        <h2 className="font-display text-[16px] font-bold text-fog-100">All outreach</h2>
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-fog-500">
          {list.length} {list.length === 1 ? "prospect" : "prospects"}
        </span>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const n = f.id === "all"
            ? prospects.length
            : f.id === "active"
              ? activeList.length
              : prospects.filter((p) => p.status === f.id).length;
          return (
            <FilterBtn
              key={f.id}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
              label={`${f.label} · ${n}`}
            />
          );
        })}
      </div>

      {/* All outreach list */}
      {list.length === 0 ? (
        <EmptyState
          icon={<IInbox size={20} />}
          title={emptyTitle}
          body={emptyBody}
          action={prospects.length === 0 ? <Button onClick={() => nav("/app/projects")}><IRadar size={14} /> Discover people</Button> : undefined}
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-pine-700/80 bg-pine-900/40">
          {list.map((p) => (
            <li
              key={p.id}
              className="group flex flex-wrap items-center gap-3.5 border-b border-pine-700/60 px-4 py-3 last:border-b-0 transition-colors hover:bg-pine-900/70"
            >
              <Avatar url={p.avatarUrl} login={p.login} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/prospects/${p.id}`} className="text-[14px] font-semibold text-fog-100 hover:text-signal-300">@{p.login}</Link>
                  <StatusPill status={p.status} />
                  <Badge tone="pine" className="font-mono text-[10px]">{projectName(p.projectId)}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-fog-500">{p.explanation}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-[16px] font-bold leading-none text-fog-100">{p.score}</div>
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-fog-500">{p.confidence}</div>
                </div>
                <QuickAdvance
                  status={p.status}
                  onAdvance={(to) => {
                    setStatus(p.id, to, { channel: to === "contacted" ? (p.contactChannel ?? "github") : undefined });
                    toast("ok", `@${p.login} → ${statusLabel(to)}`);
                  }}
                />
                <Link
                  to={`/app/prospects/${p.id}`}
                  aria-label={`Open @${p.login}`}
                  className="rounded-md border border-pine-600 p-2 text-fog-400 transition-colors hover:border-signal-500/60 hover:text-signal-300"
                >
                  <IArrowR size={13} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Funnel — compact, below main workspace */}
      <section className="mt-10 border-t border-pine-700/60 pt-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-[16px] font-bold text-fog-100">Pipeline</h2>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-fog-500">your records only</span>
        </div>
        {prospects.length === 0 ? (
          <p className="text-[12.5px] text-fog-500">Numbers appear once prospects exist. We never show rates we can't back with your records.</p>
        ) : (
          <>
            <FunnelViz stages={funnel.stages} />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11.5px] text-fog-500">
              <span><span className="font-mono text-fog-300">{funnel.notInterested}</span> not interested</span>
              <span><span className="font-mono text-fog-300">{funnel.archived}</span> archived</span>
            </div>
          </>
        )}
      </section>

      {/* Trust panel */}
      <section className="mt-10 rounded-lg border border-pine-700/60 bg-pine-900/40 p-5">
        <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fog-400">
          <ISend size={12} /> Human-controlled outreach
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-fog-300">
          Every message is personal. UserScout helps with context — you decide whether and how to reach out.
        </p>
        <ul className="mt-3 grid gap-1.5 text-[12.5px] leading-relaxed text-fog-400 sm:grid-cols-2">
          <li className="flex gap-2"><span className="text-fog-500">—</span> One personal message per person.</li>
          <li className="flex gap-2"><span className="text-fog-500">—</span> Reference their public evidence.</li>
          <li className="flex gap-2"><span className="text-fog-500">—</span> No automated sequences or follow-up spam.</li>
          <li className="flex gap-2"><span className="text-fog-500">—</span> "Not interested" means don't contact them again.</li>
        </ul>
      </section>
    </>
  );
}

/* — subcomponents — */

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-pine-700/70 bg-pine-900/50 px-3.5 py-2.5">
      <div className={cx("font-display text-[18px] font-bold leading-none", accent && value > 0 ? "text-signal-400" : "text-fog-100")}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-fog-500">{label}</div>
    </div>
  );
}

function NextCard({
  prospect,
  onOpen,
}: {
  prospect: import("../core/types").Prospect;
  onOpen: () => void;
}) {
  const evidenceCount = prospect.signals.reduce((n, s) => n + s.evidence.length, 0);
  const evidenceStrength =
    prospect.confidence === "high" ? "Strong evidence" :
    prospect.confidence === "medium" ? "Medium evidence" :
    "Weak evidence";
  const recency = prospect.lastActivityAt ? `Active ${timeAgo(prospect.lastActivityAt)}` : "No recent activity";

  return (
    <article className="flex h-full flex-col rounded-lg border border-pine-700/80 bg-pine-900/60 p-4 transition-colors hover:border-signal-500/50">
      <header className="flex items-start gap-3">
        <Avatar url={prospect.avatarUrl} login={prospect.login} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14.5px] font-semibold text-fog-100">@{prospect.login}</span>
            {prospect.name && <span className="text-[12px] text-fog-400">{prospect.name}</span>}
          </div>
        </div>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-wider text-fog-500">
        <span><span className="text-fog-200">{prospect.score}</span> relevance</span>
        <span aria-hidden="true">·</span>
        <span>{evidenceStrength}</span>
        <span aria-hidden="true">·</span>
        <span>{recency}</span>
      </div>

      <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-fog-300">
        {prospect.explanation}
      </p>

      <div className="mt-auto pt-4">
        <Button size="sm" variant="outline" onClick={onOpen} className="w-full">
          Review prospect <IArrowR size={12} />
        </Button>
      </div>
    </article>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
        active
          ? "border-signal-500/60 bg-signal-500/12 text-signal-300"
          : "border-pine-600 text-fog-400 hover:text-fog-100",
      )}
    >
      {label}
    </button>
  );
}

function QuickAdvance({ status, onAdvance }: { status: ProspectStatus; onAdvance: (to: ProspectStatus) => void }) {
  const next: Partial<Record<ProspectStatus, { to: ProspectStatus; label: string }>> = {
    saved: { to: "contacted", label: "Contacted" },
    contacted: { to: "replied", label: "Replied" },
    replied: { to: "tried", label: "Tried it" },
    tried: { to: "feedback", label: "Feedback" },
    feedback: { to: "user", label: "Became user" },
  };
  const n = next[status];
  if (!n) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => onAdvance(n.to)} title={`Move to: ${n.label}`}>
      <ICheck size={11} /> {n.label}
    </Button>
  );
}
