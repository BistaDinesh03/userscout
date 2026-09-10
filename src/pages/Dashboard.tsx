/* Projects — every project you've pointed UserScout at, with its pipeline. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { computeFunnel } from "../core/services";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, Chip } from "../components/bits";
import {
  IArrowR, IBranch, IFork, IIssue, IPlus, IRadar, IStar, ITrash, IUsers,
} from "../components/icons";
import { Badge, Button, EmptyState, Modal, StatusPill } from "../components/ui";
import { formatNumber, timeAgo } from "../core/utils";

export default function Dashboard() {
  const { projects, prospects, deleteProject, toast } = useWorkspace();
  const nav = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);

  const stats = useMemo(() => {
    const active = prospects.filter((p) => !p.archived && p.status !== "not_interested");
    return {
      projects: projects.length,
      saved: active.length,
      contacted: active.filter((p) => ["contacted", "replied", "tried", "feedback", "user"].includes(p.status)).length,
      users: prospects.filter((p) => p.status === "user").length,
    };
  }, [projects, prospects]);

  const target = projects.find((p) => p.id === toDelete);

  return (
    <>
      <PageHead
        title="Projects"
        sub="Every GitHub project you've pointed UserScout at, and where its discovery pipeline stands."
        right={
          <Button onClick={() => nav("/app/projects/new")}>
            <IPlus size={14} /> Add project
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Projects" value={stats.projects} />
        <StatTile label="Prospects saved" value={stats.saved} />
        <StatTile label="Contacted" value={stats.contacted} />
        <StatTile label="Became users" value={stats.users} accent />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<IRadar size={20} />}
          title="No projects yet"
          body="Add a public GitHub repository. UserScout analyzes what it does, derives who it's for, then finds people with public evidence connected to the problem it solves."
          action={
            <Button onClick={() => nav("/app/projects/new")}>
              <IPlus size={14} /> Add your first project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((p) => {
            const pros = prospects.filter((x) => x.projectId === p.id);
            const funnel = computeFunnel(pros);
            const top = pros[0];
            const activeCount = pros.filter((x) => !x.archived).length;
            return (
              <article
                key={p.id}
                className="group flex flex-col rounded-lg border border-pine-700/80 bg-pine-900/60 transition-colors hover:border-pine-600"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-pine-700/60 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/app/projects/${p.id}`}
                        className="truncate font-display text-[15.5px] font-bold text-fog-100 hover:text-signal-300"
                      >
                        {p.profile.fullName}
                      </Link>
                      {p.discoverable && (
                        <Badge tone="teal" className="shrink-0 font-mono text-[9.5px]">
                          listed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fog-400">
                      {p.profile.description || "No description on the repository."}
                    </p>
                  </div>
                  <button
                    onClick={() => setToDelete(p.id)}
                    aria-label={`Delete ${p.profile.fullName}`}
                    className="shrink-0 rounded p-1.5 text-fog-500 opacity-0 transition-opacity hover:bg-ember-500/10 hover:text-ember-400 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <ITrash size={14} />
                  </button>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11.5px] text-fog-400">
                  {p.profile.primaryLanguage && (
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-signal-400" />
                      {p.profile.primaryLanguage}
                    </span>
                  )}
                  <span className="flex items-center gap-1"><IStar size={11} className="text-fog-500" />{formatNumber(p.profile.stars)}</span>
                  <span className="flex items-center gap-1"><IFork size={11} className="text-fog-500" />{formatNumber(p.profile.forks)}</span>
                  <span className="flex items-center gap-1"><IIssue size={11} className="text-fog-500" />{formatNumber(p.profile.openIssues)}</span>
                  {p.profile.topics.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-pine-700/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fog-400">
                    <span className="flex items-center gap-1.5 text-fog-200"><IUsers size={12} /> {activeCount} prospects</span>
                    <span className="flex items-center gap-1.5 text-leaf-300"><IBranch size={12} /> {funnel.stages[5].count} users</span>
                    <span className="font-mono text-[10.5px] text-fog-500">
                      {p.lastDiscoveryAt ? `scouted ${timeAgo(p.lastDiscoveryAt)}` : "not scouted yet"}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => nav(`/app/projects/${p.id}/discovery`)}>
                      <IRadar size={12} /> Scout
                    </Button>
                    <Link to={`/app/projects/${p.id}`} aria-label={`Open ${p.profile.fullName}`}>
                      <Button size="sm" variant="ghost"><IArrowR size={13} /></Button>
                    </Link>
                  </div>
                </div>

                {/* Top match strip */}
                {top && (
                  <div className="flex items-center gap-2 border-t border-pine-700/40 bg-pine-950/40 px-4 py-2.5 text-[11.5px] text-fog-500">
                    <Avatar url={top.avatarUrl} login={top.login} size={18} />
                    <span>Top match</span>
                    <Link to={`/app/prospects/${top.id}`} className="font-medium text-fog-300 hover:text-signal-300">@{top.login}</Link>
                    <span className="ml-auto"><StatusPill status={top.status} /></span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Modal open={!!target} onClose={() => setToDelete(null)} title="Delete project?">
        {target && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-fog-300">
              Deleting <strong className="text-fog-100">{target.profile.fullName}</strong> removes its{" "}
              {prospects.filter((x) => x.projectId === target.id).length} prospects, all private notes, outreach history, and feedback. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteProject(target.id);
                  setToDelete(null);
                  toast("info", `${target.profile.fullName} deleted with all private records.`);
                }}
              >
                <ITrash size={13} /> Delete everything
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-md border border-pine-700/70 bg-pine-900/50 px-3.5 py-3">
      <div className={`font-display text-[20px] font-bold leading-none ${accent ? "text-signal-400" : "text-fog-100"}`}>{value}</div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-fog-500">{label}</div>
    </div>
  );
}
