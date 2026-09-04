/* Outreach workspace — the manual CRM across all projects. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { computeFunnel } from "../core/services";
import type { ProspectStatus } from "../core/types";
import { STATUSES, statusLabel } from "../core/types";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, FunnelViz } from "../components/bits";
import { IArrowR, IInbox, IRadar, ISend } from "../components/icons";
import { Badge, Button, EmptyState, StatusPill } from "../components/ui";
import { cx, timeAgo } from "../core/utils";

export default function Outreach() {
  const { prospects, projects, setStatus, toast } = useWorkspace();
  const nav = useNavigate();
  const [filter, setFilter] = useState<ProspectStatus | "active">("active");

  const funnel = useMemo(() => computeFunnel(prospects), [prospects]);
  const projectName = (id: string) => projects.find((p) => p.id === id)?.profile.fullName ?? "deleted project";

  const list = useMemo(() => {
    const base = prospects.filter((p) => (filter === "active" ? !p.archived && p.status !== "not_interested" : p.status === filter));
    return base.sort((a, b) => b.score - a.score);
  }, [prospects, filter]);

  return (
    <>
      <PageHead title="Outreach workspace" sub="Your pipeline, tracked by hand — because every message is personal or it's spam." />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-4 flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter by status">
            <FilterBtn active={filter === "active"} onClick={() => setFilter("active")} label={`Active · ${prospects.filter((p) => !p.archived && p.status !== "not_interested").length}`} />
            {STATUSES.map((s) => {
              const n = prospects.filter((p) => p.status === s.id).length;
              return <FilterBtn key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)} label={`${s.label} · ${n}`} />;
            })}
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<IInbox size={20} />}
              title={prospects.length === 0 ? "Pipeline is empty" : `Nothing in “${filter === "active" ? "Active" : statusLabel(filter as ProspectStatus)}”`}
              body={prospects.length === 0 ? "Save prospects from a discovery run first. Only people with evidence belong here — quality over quantity." : "People move through this pipeline from their detail page."}
              action={prospects.length === 0 ? <Button onClick={() => nav("/app/projects")}><IRadar size={14} /> Scout a project</Button> : undefined}
            />
          ) : (
            <ul className="space-y-2">
              {list.map((p) => (
                <li key={p.id} className="group flex flex-wrap items-center gap-3.5 rounded-md border border-pine-700/80 bg-pine-900/60 px-4 py-3 transition-all hover:border-pine-600 sm:flex-nowrap">
                  <Avatar url={p.avatarUrl} login={p.login} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/app/prospects/${p.id}`} className="text-[14px] font-semibold text-fog-100 hover:text-signal-300">@{p.login}</Link>
                      <StatusPill status={p.status} />
                      <Badge tone="pine" className="font-mono">{projectName(p.projectId)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-fog-500">{p.explanation}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-[16px] font-bold leading-none text-fog-100">{p.score}</div>
                      <div className="font-mono text-[8.5px] uppercase tracking-wider text-fog-500">{p.confidence}</div>
                    </div>
                    <QuickAdvance status={p.status} onAdvance={(to) => { setStatus(p.id, to, { channel: to === "contacted" ? (p.contactChannel ?? "github") : undefined }); toast("ok", `@${p.login} → ${statusLabel(to)}`); }} />
                    <Link to={`/app/prospects/${p.id}`} aria-label={`Open @${p.login}`} className="rounded-md border border-pine-600 p-2 text-fog-400 transition-colors hover:border-signal-500/60 hover:text-signal-300">
                      <IArrowR size={13} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="brackets rounded-lg border border-pine-600 bg-pine-900/80 p-5">
            <h2 className="mb-3 font-display text-[14px] font-bold">Live funnel</h2>
            {prospects.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-fog-500">Numbers appear once prospects exist. We never show rates we can't back with your records.</p>
            ) : (
              <>
                <FunnelViz stages={funnel.stages} />
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-pine-700 pt-3 text-center">
                  <div><div className="font-display text-[18px] font-bold text-ember-400">{funnel.notInterested}</div><div className="text-[9.5px] uppercase tracking-wider text-fog-500">not interested</div></div>
                  <div><div className="font-display text-[18px] font-bold text-fog-300">{funnel.archived}</div><div className="text-[9.5px] uppercase tracking-wider text-fog-500">archived</div></div>
                </div>
              </>
            )}
          </section>
          <section className="rounded-lg border border-pine-700/70 bg-pine-900/50 p-4">
            <h3 className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider text-fog-400"><ISend size={12} /> outreach rules</h3>
            <ul className="mt-2.5 space-y-1.5 text-[11.5px] leading-relaxed text-fog-500">
              <li>· One personal message per person. Reference their evidence.</li>
              <li>· No sequences, no automation, no "quick follow-up" nags.</li>
              <li>· "Not interested" means never again — it's a permanent no.</li>
            </ul>
          </section>
          {prospects.filter((p) => p.status === "saved").slice(0, 3).map((p) => (
            <button key={p.id} onClick={() => nav(`/app/prospects/${p.id}`)} className="w-full rounded-md border border-pine-700 bg-pine-900/60 px-3.5 py-2.5 text-left transition-colors hover:border-signal-500/50">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-medium text-fog-200">@{p.login}</span>
                <span className="font-mono text-[9.5px] uppercase text-fog-500">needs first contact</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-pine-700"><div className="h-full bg-signal-500/70" style={{ width: `${p.score}%` }} /></div>
            </button>
          ))}
        </aside>
      </div>
    </>
  );
}

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button role="tab" aria-selected={active} onClick={onClick} className={cx("rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors", active ? "border-signal-500/60 bg-signal-500/12 text-signal-300" : "border-pine-600 text-fog-400 hover:text-fog-100")}>
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
      <ICheckSm /> {n.label}
    </Button>
  );
}

function ICheckSm() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.5 10 18 19.5 6.5" />
    </svg>
  );
}
