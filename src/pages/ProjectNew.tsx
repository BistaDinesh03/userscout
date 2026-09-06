/* Add-project flow: validate → analyze (live console) → review → save. */

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeRepository } from "../core/analysis";
import { GitHubApiError } from "../core/github";
import type { AnalysisProgress, DiscoveryProgress, ProjectProfile } from "../core/types";
import { useWorkspace } from "../state/store";
import { AppError } from "../core/utils";
import { PageHead } from "../components/layout";
import { Chip, ConsoleLog } from "../components/bits";
import { IAlert, IArrowL, IArrowR, IBranch, IStar } from "../components/icons";
import { Badge, Button, Field, Input } from "../components/ui";
import { formatNumber } from "../core/utils";

export default function ProjectNew() {
  const { gh, createProject, toast } = useWorkspace();
  const nav = useNavigate();
  const [value, setValue] = useState("");
  const [lines, setLines] = useState<DiscoveryProgress[]>([]);
  const [phase, setPhase] = useState<"idle" | "run" | "done" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setDupId(null);
    setProfile(null);
    setLines([]);
    setPhase("run");
    try {
      const p = await analyzeRepository(gh, value, (prog: AnalysisProgress) => {
        setLines((ls) => [...ls.filter((l) => l.stepId !== prog.phase), { stepId: prog.phase, message: prog.message, status: prog.done ? "ok" : "run" }]);
      });
      setProfile(p);
      setPhase("done");
    } catch (err) {
      const msg = err instanceof GitHubApiError ? err.message : "Unexpected error while analyzing.";
      setError(msg);
      setLines((ls) => [...ls, { stepId: "err", message: msg, status: "err" }]);
      setPhase("err");
    }
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const p = await createProject(profile);
      toast("ok", `${profile.fullName} added. Ready to scout for users.`);
      nav(`/app/projects/${p.id}`);
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") {
        setDupId(err.message);
        setError("This repository is already in your workspace.");
      } else {
        setError(err instanceof Error ? err.message : "Could not save the project.");
      }
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead
        title="Add a GitHub project"
        sub="Public repositories only. UserScout reads metadata + README via the official API — nothing private."
        right={<Button variant="ghost" onClick={() => nav(-1)}><IArrowL size={13} /> Back</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="brackets rounded-lg border border-pine-600 bg-pine-900/80 p-5">
          <form onSubmit={run} className="space-y-3">
            <Field label="Repository URL" hint="github.com/owner/repo or owner/repo">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. github.com/yourname/your-tool"
                spellCheck={false}
                autoFocus
                className="font-mono"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={phase === "run"} disabled={!value.trim()}>
                <IBranch size={14} /> Analyze repository
              </Button>
              {phase !== "idle" && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPhase("idle"); setLines([]); setError(null); setProfile(null); setDupId(null); }}>
                  Reset
                </Button>
              )}
            </div>
          </form>

          <ConsoleLog lines={lines} className="mt-5 h-44" />

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-md border border-ember-500/35 bg-ember-500/10 px-3 py-2.5 text-[12.5px] text-ember-400">
              <IAlert size={15} className="mt-px shrink-0" />
              <div>
                {error}
                {dupId && (
                  <button onClick={() => nav(`/app/projects/${dupId}`)} className="mt-1 block font-medium text-signal-300 underline underline-offset-2">
                    Open the existing project →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          {!profile ? (
            <div className="rounded-lg border border-dashed border-pine-600 bg-pine-900/40 p-5 text-[12.5px] leading-relaxed text-fog-500">
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-fog-400">What analysis extracts</p>
              <ul className="space-y-1.5">
                <li>· description, topics, stars, forks, issues</li>
                <li>· primary language + README excerpt</li>
                <li>· derived keywords (frequency-based, deterministic)</li>
                <li>· likely problem space & target audience</li>
                <li>· query terms used by discovery</li>
              </ul>
              <p className="mt-3 border-t border-pine-700 pt-3">Analysis uses ≤3 public API calls. Discovery adds ~5 search + a few profile calls, paced to respect rate limits.</p>
            </div>
          ) : (
            <div className="reveal space-y-4 rounded-lg border border-pine-600 bg-pine-900/80 p-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <a href={profile.url} target="_blank" rel="noopener noreferrer" className="font-display text-[17px] font-bold text-fog-100 hover:text-signal-300">{profile.fullName}</a>
                  <Badge tone="green" className="font-mono"><IStar size={10} /> {formatNumber(profile.stars)}</Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-fog-400">{profile.description || "No description"}</p>
              </div>

              <div>
                <SectionLabel>Derived keywords</SectionLabel>
                <div className="flex flex-wrap gap-1.5">{profile.keywords.map((k) => <Chip key={k}>{k}</Chip>)}</div>
              </div>

              <div>
                <SectionLabel>Likely problem space</SectionLabel>
                <ul className="space-y-1 text-[12.5px] leading-relaxed text-fog-300">
                  {profile.problemSpace.map((s) => <li key={s}>· {s}</li>)}
                </ul>
              </div>

              <div>
                <SectionLabel>Likely target audience</SectionLabel>
                <ul className="space-y-1 text-[12.5px] text-fog-300">
                  {profile.audience.map((a) => <li key={a} className="flex items-start gap-2"><span className="mt-1.5 size-1 rounded-full bg-signal-400" />{a}</li>)}
                </ul>
              </div>

              <div>
                <SectionLabel>Discovery will search for</SectionLabel>
                <div className="flex flex-wrap gap-1.5">{profile.queryTerms.map((t) => <Badge key={t} tone="amber" className="font-mono">“{t}”</Badge>)}</div>
              </div>

              <div className="flex gap-2 border-t border-pine-700 pt-4">
                <Button onClick={save} loading={saving} className="flex-1">Save project <IArrowR size={13} /></Button>
                <Button variant="outline" onClick={run}>Re-analyze</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-fog-500">{children}</div>;
}
