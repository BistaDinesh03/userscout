/* Community — projects owners opted in to share on this device. */

import { Link, useNavigate } from "react-router-dom";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Chip } from "../components/bits";
import { IBranch, ICompass, IExt, ILayers, IStar, IUsers } from "../components/icons";
import { Badge, Button, EmptyState, Toggle } from "../components/ui";
import { formatNumber } from "../core/utils";

export default function Community() {
  const { community, user, projects, setDiscoverable, toast } = useWorkspace();
  const nav = useNavigate();
  const others = community.filter((c) => !c.mine);
  const mine = projects.filter((p) => p.ownerId === user?.id);
  const emptyAll = others.length === 0 && mine.length === 0;

  return (
    <>
      <PageHead
        title="Community"
        sub="Projects other workspace accounts on this device have chosen to list publicly. Opt-in, public repo data only."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {emptyAll ? (
            <EmptyState
              icon={<ICompass size={20} />}
              title="No projects yet"
              body="Add a project first — then you can opt it in to the local community index."
              action={<Button onClick={() => nav("/app/projects/new")}><ILayers size={14} /> Add project</Button>}
            />
          ) : others.length === 0 ? (
            <EmptyState
              icon={<ICompass size={20} />}
              title="Nothing listed yet"
              body="Flip 'List in community' on one of your projects to make it discoverable to other workspace accounts on this device."
            />
          ) : (
            <ul className="space-y-3">
              {others.map((c) => (
                <li key={c.project.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-pine-700/80 bg-pine-900/60 p-4 transition-colors hover:border-pine-600">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={c.project.profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-display text-[15px] font-bold text-fog-100 hover:text-signal-300"
                      >
                        {c.project.profile.fullName}
                      </a>
                      <Badge tone="teal" className="font-mono text-[9.5px]">@{c.ownerUsername}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] text-fog-400">
                      {c.project.profile.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-fog-500">
                      <span className="flex items-center gap-1"><IStar size={11} /> {formatNumber(c.project.profile.stars)}</span>
                      <span className="flex items-center gap-1"><IBranch size={11} /> {c.project.profile.primaryLanguage || "—"}</span>
                      <span className="flex items-center gap-1"><IUsers size={11} /> {c.prospectCount} prospects · {c.userCount} converted</span>
                      {c.project.profile.topics.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
                    </div>
                  </div>
                  <a href={c.project.profile.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <Button size="sm" variant="outline"><IExt size={12} /> Try it</Button>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
            <h2 className="mb-3 font-display text-[14px] font-bold">Your listings</h2>
            {mine.length === 0 ? (
              <p className="text-[12.5px] text-fog-500">Add a project to control its visibility here.</p>
            ) : (
              <ul className="space-y-2.5">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-pine-700 bg-pine-950/50 px-3 py-2.5">
                    <div className="min-w-0">
                      <Link to={`/app/projects/${p.id}`} className="block truncate text-[12.5px] font-semibold text-fog-200 hover:text-signal-300">
                        {p.profile.fullName}
                      </Link>
                      <span className="font-mono text-[10px] text-fog-500">
                        {p.discoverable ? "visible to local accounts" : "private"}
                      </span>
                    </div>
                    <Toggle
                      checked={p.discoverable}
                      onChange={(v) => {
                        setDiscoverable(p.id, v);
                        toast("ok", v ? `${p.profile.repo} listed in community.` : `${p.profile.repo} unlisted.`);
                      }}
                      label=""
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-pine-700/70 bg-pine-900/50 p-4">
            <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-fog-400">What gets shared</h3>
            <p className="text-[11.5px] leading-relaxed text-fog-500">
              Only the public repository metadata you already fetched — name, description, topics, stars — plus your username.
              Prospects, notes, and outreach records are <strong className="text-fog-300">never</strong> part of the index. Listings can be removed at any time.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
