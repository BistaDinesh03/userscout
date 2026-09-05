/* Discovery â€” run evidence-based searches, review, save. No automation. */

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildSearchPlan, runDiscovery } from "../core/discovery";
import { GitHubApiError } from "../core/github";
import { SIGNAL_DOCS } from "../core/scoring";
import type { DiscoveryProgress, ScoredCandidate } from "../core/types";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, Chip, ConsoleLog, EvidenceRow, ScoreDial, SignalBreakdown } from "../components/bits";
import { IAlert, IArrowL, IBook, ICheck, IChevronD, IRadar, ISearch, IUsers } from "../components/icons";
import { Badge, Button, ConfidenceBadge, EmptyState, Modal } from "../components/ui";
import { cx, formatClock } from "../core/utils";

export default function Discovery() {
  const { id } = useParams<{ id: string }>();
  const { projects, prospects, gh, saveDiscovery, toast } = useWorkspace();
  const nav = useNavigate();
  const [lines, setLines] = useState<DiscoveryProgress[]>([]);
  const [results, setResults] = useState<ScoredCandidate[] | null>(null);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [savedLogins, setSavedLogins] = useState<Set<string>>(new Set());
  const runId = useRef(0);

  const project = projects.find((p) => p.id === id);
  const plan = useMemo(() => (project ? buildSearchPlan(project.profile) : []), [project]);
  const existingLogins = useMemo(
    () => new Set(prospects.filter((p) => p.projectId === id).map((p) => p.login.toLowerCase())),
    [prospects, id],
  );

  if (!project) {
    return (
      <EmptyState icon={<IAlert size={20} />} title="Project not found" body="Head back to your projects and pick one to scout."
        action={<Link to="/app/projects"><Button><IArrowL size={13} /> Back to projects</Button></Link>} />
    );
  }

  const addLine = (p: DiscoveryProgress) =>
    setLines((ls) => [...ls.filter((l) => !(l.stepId === p.stepId && l.status === "run")), p]);

  const run = async () => {
    const my = ++runId.current;
    setRunning(true);
    setFatal(null);
    setResults(null);
    setLines([{ stepId: "start", status: "run", message: `Scouting users for ${project.profile.fullName} â€” ${formatClock(Date.now())}` }]);
    try {
      const res = await runDiscovery(gh, project.profile, {
        onProgress: addLine,
        onPartial: (scored) => {
          if (runId.current === my) setResults(scored);
        },
      });
      if (runId.current === my) {
        setResults(res);
        addLine({ stepId: "end", status: "ok", message: `Done â€” ${res.length} candidates ranked by evidence. Save the ones worth a personal message.` });
      }
    } catch (err) {
      if (runId.current !== my) return;
      const msg = err instanceof GitHubApiError ? err.message : "Discovery failed unexpectedly.";
      setFatal(msg);
      addLine({ stepId: "end", status: "err", message: msg });
    } finally {
      if (runId.current === my) setRunning(false);
    }
  };

  const saveOne = (s: ScoredCandidate) => {
    const r = saveDiscovery(project.id, [s]);
    setSavedLogins((set) => new Set(set).add(s.candidate.login.toLowerCase()));
    toast("ok", r.created ? `@${s.candidate.login} saved to prospects.` : `@${s.candidate.login} refreshed with new evidence.`);
  };

  const saveTop = () => {
    if (!results) return;
    const top = results.filter((r) => r.score >= 45).slice(0, 5);
    if (!top.length) {
      toast("info", "Nothing above 45/100 â€” saving weak leads goes against the philosophy.");
      return;
    }
    const r = saveDiscovery(project.id, top);
    setSavedLogins((set) => {
      const n = new Set(set);
      top.forEach((t) => n.add(t.candidate.login.toLowerCase()));
      return n;
    });
    toast("ok", `${r.created} saved Â· ${r.updated} refreshed.`);
  };

  const strongCount = results?.filter((r) => r.confidence !== "low").length ?? 0;

  return (
    <>
      <PageHead
        title={`Scout Â· ${project.profile.fullName}`}
        sub="Public signals only. Every candidate below comes with receipts."
        right={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowModel(true)}><IBook size={13} /> Scoring model</Button>
            <Button variant="outline" size="sm" onClick={() => nav(`/app/projects/${project.id}`)}><IArrowL size={13} /> Project</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* left: plan + console */}
        <div className="space-y-4">
          <section className="brackets rounded-lg border border-pine-600 bg-pine-900/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[14px] font-bold">Search plan</h2>
              <span className="font-mono text-[10px] text-fog-500">{plan.length} steps</span>
            </div>
            <ol className="space-y-2.5">
              {plan.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <span className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
                    lines.some((l) => l.stepId === s.id && l.status === "ok") ? "bg-leaf-500/20 text-leaf-300"
                      : lines.some((l) => l.stepId === s.id && l.status === "run") ? "bg-signal-500/20 text-signal-300"
                      : lines.some((l) => l.stepId === s.id && l.status === "err") ? "bg-ember-500/20 text-ember-400"
                      : "bg-pine-700 text-fog-400")}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-[12.5px] font-semibold text-fog-200">{s.label}</div>
                    <div className="text-[11.5px] leading-relaxed text-fog-500">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
            <Button onClick={run} loading={running} className="mt-4 w-full">
              <IRadar size={14} /> {results ? "Run again" : "Start scouting"}
            </Button>
            <p className="mt-2.5 text-center font-mono text-[9.5px] leading-relaxed text-fog-500">
              paced for GitHub rate limits Â· ~15 public API calls
            </p>
          </section>

          <ConsoleLog lines={lines} className="max-h-[300px]" />

          {fatal && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md border border-ember-500/35 bg-ember-500/10 px-3 py-2.5 text-[12.5px] text-ember-400">
              <IAlert size={15} className="mt-px shrink-0" /> {fatal}
            </div>
          )}
        </div>

        {/* right: results */}
        <div className="min-w-0">
          {!results && !running && (
            <EmptyState icon={<ISearch size={20} />} title="No results yet" body="Run the search plan. Candidates appear ranked by a deterministic score, each backed by public evidence you can verify yourself." />
          )}
          {running && !results && (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border border-pine-700/60 bg-pine-900/60" style={{ animationDelay: `${i * 130}ms` }} />
              ))}
            </div>
          )}

          {results && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-fog-400">
                  <strong className="text-fog-100">{results.length}</strong> candidates Â·{" "}
                  <strong className={strongCount ? "text-leaf-300" : "text-fog-100"}>{strongCount}</strong> with strong-signal confidence
                </p>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Button size="sm" variant="outline" onClick={saveTop}><IUsers size={13} /> Save strong leads (â‰¥45)</Button>
                  <Link to={`/app/projects/${project.id}`}><Button size="sm" variant="ghost">View saved â†’</Button></Link>
                </div>
              </div>

              {results.length === 0 ? (
                <EmptyState icon={<IUsers size={20} />} title="No candidates with evidence" body="Nobody matching the query terms surfaced in public search right now. Check the repo has a clear description and topics â€” discovery quality follows analysis quality." />
              ) : (
                <ul className="space-y-3">
                  {results.map((r, idx) => {
                    const saved = savedLogins.has(r.candidate.login.toLowerCase()) || existingLogins.has(r.candidate.login.toLowerCase());
                    const open = expanded === r.candidate.login;
                    return (
                      <li key={r.candidate.login} className="reveal rounded-lg border border-pine-700/80 bg-pine-900/70 transition-colors hover:border-pine-600" style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className="flex flex-wrap items-start gap-3.5 p-4 sm:gap-4">
                          <div className="flex shrink-0 flex-col items-center justify-center rounded-md border border-pine-700 bg-pine-950/50 px-3 py-2" style={{ width: 68 }}>
                            <span className="font-display text-[20px] font-bold leading-none text-fog-100">{r.score}</span>
                            <span className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-fog-500">relevance</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Avatar url={r.candidate.avatarUrl} login={r.candidate.login} size={24} />
                              <a href={r.candidate.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-[15px] font-bold text-fog-100 hover:text-signal-300">
                                @{r.candidate.login}
                              </a>
                              {r.candidate.name && <span className="text-[12.5px] text-fog-400">{r.candidate.name}</span>}
                              <ConfidenceBadge c={r.confidence} />
                            </div>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog-300">
                              <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider text-signal-400">why</span>
                              {r.explanation}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {r.candidate.sources.filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 2).map((s) => <Chip key={s}>{s.replace("public-issues", "discussion").replace("topic-repos", "related repo")}</Chip>)}
                              <button onClick={() => setExpanded(open ? null : r.candidate.login)} aria-expanded={open} className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10.5px] text-fog-400 hover:text-signal-300">
                                evidence <IChevronD size={11} className={cx("transition-transform", open && "rotate-180")} />
                              </button>
                            </div>
                          </div>
                          <div className="flex w-full shrink-0 flex-row items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                            {saved ? (
                              <Badge tone="green" className="font-mono"><ICheck size={10} /> IN PROSPECTS</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => saveOne(r)} disabled={running}>Save prospect</Button>
                            )}
                            <span className="font-mono text-[9.5px] uppercase tracking-wider text-fog-500">score {r.score}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="grid gap-4 border-t border-pine-700/70 bg-pine-950/40 p-4 md:grid-cols-2">
                            <div>
                              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fog-500">Signal breakdown</div>
                              <SignalBreakdown signals={r.signals} compact />
                            </div>
                            <div>
                              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fog-500">Evidence ({r.candidate.evidences.length})</div>
                              <ul className="space-y-1.5">
                                {r.candidate.evidences.map((e, i) => <EvidenceRow key={i} e={e} />)}
                              </ul>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={showModel} onClose={() => setShowModel(false)} title="Scoring model (deterministic)" wide>
        <div className="space-y-2">
          {SIGNAL_DOCS.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-4 rounded-md border border-pine-700 bg-pine-900/60 px-3.5 py-2.5">
              <div>
                <div className="text-[13px] font-semibold text-fog-100">{s.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-fog-400">{s.rule}</div>
              </div>
              <Badge tone="amber" className="shrink-0 font-mono">max +{s.max}</Badge>
            </div>
          ))}
          <p className="pt-2 text-[11.5px] leading-relaxed text-fog-500">
            Signals sum, capped at 100. Confidence: HIGH = score â‰¥70 with a strong signal â‰¥20 pts Â· MEDIUM = score â‰¥45 or any strong signal Â· else LOW.
            Weak-only candidates can never exceed 43. Same evidence in â†’ same score out.
          </p>
        </div>
      </Modal>
    </>
  );
}



