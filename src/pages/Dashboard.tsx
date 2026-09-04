/* Projects dashboard — list, stats, delete, launch discovery. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { computeFunnel } from "../core/services";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, Chip, Stat } from "../components/bits";
import { IArrowR, IBranch, IFork, IIssue, IPlus, IRadar, IStar, ITrash, IUsers, ILayers } from "../components/icons";
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
        sub="Every project you've pointed UserScout at, with its discovery pipeline."
        right={
          <Button onClick={() => nav("/app/projects/new")}>
            <IPlus size={14} /> Add GitHub project
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projects tracked" value={stats.projects} />
        <Stat label="Prospects saved" value={stats.saved} />
        <Stat label="Personally contacted" value={stats.contacted} />
        <Stat label="Converted to users" value={stats.users} accent />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<IRadar size={22} />}
          title="No projects yet"
          body="Add a public GitHub repository. UserScout analyzes what it does, derives who it's for, then hunts for people with public evidence they need it."
          action={<Button onClick={() => nav("/app/projects/new")}><IPlus size={14} /> Add your first project</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((p, i) => {
            const pros = prospects.filter((x) => x.projectId === p.id);
            const funnel = computeFunnel(pros);
            const top = pros[0];
            return (
              <article key={p.id} className="reveal group flex flex-col rounded-lg border border-pine-700/80 bg-pine-900/70 transition-all hover:border-pine-600 hover:shadow-soft" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between gap-3 border-b border-pine-700/60 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/app/projects/${p.id}`} className="truncate font-display text-[16px] font-bold text-fog-100 hover:text-signal-300">
                        {p.profile.fullName}
                      </Link>
                      {p.discoverable && <Badge tone="teal" className="shrink-0">community</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-fog-400">{p.profile.description || "No description on the repository."}</p>
                  </div>
                  <button onClick={() => setToDelete(p.id)} aria-label={`Delete ${p.profile.fullName}`} className="rounded-md p-1.5 text-fog-500 opacity-0 transition-all hover:bg-ember-500/10 hover:text-ember-400 group-hover:opacity-100 focus-visible:opacity-100">
                    <ITrash size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-[12px] text-fog-400">
                  {p.profile.primaryLanguage && (
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-signal-400" />{p.profile.primaryLanguage}</span>
                  )}
                  <span className="flex items-center gap-1"><IStar size={12} className="text-fog-500" />{formatNumber(p.profile.stars)}</span>
                  <span className="flex items-center gap-1"><IFork size={12} className="text-fog-500" />{formatNumber(p.profile.forks)}</span>
                  <span className="flex items-center gap-1"><IIssue size={12} className="text-fog-500" />{formatNumber(p.profile.openIssues)}</span>
                  {p.profile.topics.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-pine-700/60 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-fog-400">
                    <span className="flex items-center gap-1.5 font-medium text-fog-200"><IUsers size={13} /> {pros.filter((x) => !x.archived).length} prospects</span>
                    <span className="flex items-center gap-1.5 text-leaf-300"><IBranch size={13} /> {funnel.stages[5].count} users</span>
                    <span className="font-mono text-[10.5px] text-fog-500">{p.lastDiscoveryAt ? `scouted ${timeAgo(p.lastDiscoveryAt)}` : "not scouted yet"}</span>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button size="sm" variant="outline" onClick={() => nav(`/app/projects/${p.id}/discovery`)}>
                      <IRadar size={13} /> Scout
                    </Button>
                    <Link to={`/app/projects/${p.id}`}>
                      <Button size="sm" variant="ghost" aria-label={`Open ${p.profile.fullName}`}>
                        <IArrowR size={13} />
                      </Button>
                    </Link>
                  </div>
                </div>
                {top && (
                  <div className="flex items-center gap-2 border-t border-pine-700/40 bg-pine-950/40 px-4 py-2.5 text-[11.5px] text-fog-500">
                    <Avatar url={top.avatarUrl} login={top.login} size={18} />
                    top match <Link to={`/app/prospects/${top.id}`} className="font-medium text-fog-300 hover:text-signal-300">@{top.login}</Link>
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
            <p className="text-[13.5px] leading-relaxed text-fog-300">
              Deleting <strong className="text-fog-100">{target.profile.fullName}</strong> removes its{" "}
              {prospects.filter((x) => x.projectId === target.id).length} prospects, all private notes, outreach history and feedback. This can't be undone.
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
      {projects.length === 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] text-fog-500">
          <ILayers size={12} /> tip: the landing-page console lets you preview an analysis before signing up
        </div>
      )}
    </>
  );
}
