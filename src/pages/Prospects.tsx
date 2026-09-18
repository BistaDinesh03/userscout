/* Prospects — every person UserScout has discovered, across all projects. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar } from "../components/bits";
import { IArrowR, IInbox, IRadar } from "../components/icons";
import { Badge, Button, EmptyState, StatusPill } from "../components/ui";
import type { ProspectStatus } from "../core/types";
import { STATUSES, statusLabel } from "../core/types";
import { cx, timeAgo } from "../core/utils";

type Filter = ProspectStatus | "all" | "active";

export default function Prospects() {
  const { prospects, projects } = useWorkspace();
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>("active");

  const projectName = (id: string) => projects.find((p) => p.id === id)?.profile.fullName ?? "—";

  const list = useMemo(() => {
    const base = prospects.filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return !p.archived && p.status !== "not_interested";
      return p.status === filter;
    });
    return [...base].sort((a, b) => b.score - a.score);
  }, [prospects, filter]);

  const emptyAll = prospects.length === 0;

  return (
    <>
      <PageHead
        title="Prospects"
        sub="Everyone UserScout has discovered across your projects — the pool you decide who to contact from."
        right={
          <Button onClick={() => nav("/app/projects")} variant="outline">
            <IRadar size={13} /> Discover more
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        <FilterBtn active={filter === "active"} onClick={() => setFilter("active")} label={`Active · ${prospects.filter((p) => !p.archived && p.status !== "not_interested").length}`} />
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} label={`All · ${prospects.length}`} />
        {STATUSES.map((s) => {
          const n = prospects.filter((p) => p.status === s.id).length;
          return <FilterBtn key={s.id} active={filter === s.id} onClick={() => setFilter(s.id)} label={`${s.label} · ${n}`} />;
        })}
      </div>

      {emptyAll ? (
        <EmptyState
          icon={<IInbox size={20} />}
          title="No prospects yet"
          body="Run discovery on a project to find people with public evidence connected to the problem it solves."
          action={<Button onClick={() => nav("/app/projects")}><IRadar size={14} /> Discover people</Button>}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IInbox size={20} />}
          title={filter === "active" ? "Nothing active right now" : `Nothing in "${filter === "all" ? "All" : statusLabel(filter as ProspectStatus)}"`}
          body="Change the filter above to see prospects in other statuses."
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-pine-700/80 bg-pine-900/40">
          {list.map((p) => (
            <li key={p.id} className="group flex flex-wrap items-center gap-3.5 border-b border-pine-700/60 px-4 py-3 last:border-b-0 transition-colors hover:bg-pine-900/70">
              <Avatar url={p.avatarUrl} login={p.login} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/prospects/${p.id}`} className="text-[14px] font-semibold text-fog-100 hover:text-signal-300">@{p.login}</Link>
                  <StatusPill status={p.status} />
                  <Badge tone="pine" className="font-mono text-[10px]">{projectName(p.projectId)}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-fog-500">{p.whyThisPerson || p.explanation}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-[16px] font-bold leading-none text-fog-100">{p.score}</div>
                  <div className="font-mono text-[8.5px] uppercase tracking-wider text-fog-500">{(p.evidenceStrength ?? p.confidence ?? "").replace("_", " ")}</div>
                </div>
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
    </>
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
        active ? "border-signal-500/60 bg-signal-500/12 text-signal-300" : "border-pine-600 text-fog-400 hover:text-fog-100",
      )}
    >
      {label}
    </button>
  );
}
