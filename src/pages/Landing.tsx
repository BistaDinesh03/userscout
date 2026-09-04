/* Landing — opens with the thing UserScout actually does: scout a repo. */

import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { analyzeRepository } from "../core/analysis";
import { GitHubApiError } from "../core/github";
import { SIGNAL_DOCS, bandOf } from "../core/scoring";
import type { AnalysisProgress, DiscoveryProgress, ProjectProfile } from "../core/types";
import { useWorkspace } from "../state/store";
import { Chip, ConsoleLog, Radar, ScoreDial } from "../components/bits";
import { IAlert, IArrowR, IBranch, ICheck, ICompass, IDownload, IEye, IFlag, IHand, IIssue, ILock, IRadar, ISearch, IShield, IStar, ITerminal, IUsers, IX, IZap, IZip } from "../components/icons";
import { Badge, Button, ConfidenceBadge, Input } from "../components/ui";
import { Logo } from "../components/layout";
import { clamp, cx, formatNumber } from "../core/utils";
import { downloadProjectZip, sourceFileCount } from "../download";

const PIPELINE = [
  "GitHub repo",
  "analysis",
  "target audience",
  "discovery",
  "evidence",
  "relevance score",
  "why this person?",
  "save prospect",
  "personal outreach",
  "reply",
  "project trial",
  "feedback",
  "user",
];

export default function Landing() {
  const { user } = useWorkspace();
  return (
    <div className="relative z-10">
      <TopNav signedIn={!!user} />
      <ScoutSection signedIn={!!user} />
      <SignalHierarchy />
      <ScoringDemo />
      <LoopSection />
      <EthicsSection />
      <Footer />
    </div>
  );
}

/* One-click source bundle — the whole project as a ZIP, built in-browser. */
function DownloadButton({ variant = "outline", size = "sm", withLabel = true }: { variant?: "outline" | "ghost"; size?: "sm" | "md"; withLabel?: boolean }) {
  const { toast } = useWorkspace();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const run = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const n = await downloadProjectZip();
      setState("done");
      toast("ok", `userscout-source.zip saved — ${n} files. Unzip, then: npm install; npm run dev`);
      window.setTimeout(() => setState("idle"), 2600);
    } catch {
      setState("idle");
      toast("err", "Could not build the ZIP in this browser. Try a current Chrome/Firefox/Edge/Safari.");
    }
  };
  return (
    <Button variant={variant} size={size} onClick={run} loading={state === "busy"} aria-label="Download the complete project source as a ZIP file">
      {state === "done" ? <ICheck size={13} /> : <IDownload size={13} />}
      {withLabel && (state === "done" ? "Saved" : "Download source")}
    </Button>
  );
}

function TopNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-pine-800/80 bg-pine-950/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <a href="#top" aria-label="UserScout"><Logo /></a>
        <nav className="hidden items-center gap-6 text-[13px] text-fog-400 md:flex" aria-label="Landing sections">
          <a className="hover:text-signal-300 transition-colors" href="#signals">Signal model</a>
          <a className="hover:text-signal-300 transition-colors" href="#scoring">Scoring</a>
          <a className="hover:text-signal-300 transition-colors" href="#ethics">Ethics</a>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex"><DownloadButton /></span>
          {signedIn ? (
            <Link to="/app/projects"><Button size="sm">Open workspace <IArrowR size={13} /></Button></Link>
          ) : (
            <>
              <Link to="/auth" className="rounded-md px-3 py-1.5 text-[13px] font-medium text-fog-300 hover:text-fog-100">Sign in</Link>
              <Link to="/auth?mode=register"><Button size="sm">Create workspace</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── Opening: the scout console ── */

function ScoutSection({ signedIn }: { signedIn: boolean }) {
  const { gh } = useWorkspace();
  const [value, setValue] = useState("");
  const [lines, setLines] = useState<DiscoveryProgress[]>([]);
  const [phase, setPhase] = useState<"idle" | "run" | "done" | "err">("idle");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProjectProfile | null>(null);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setProfile(null);
    setLines([]);
    setPhase("run");
    try {
      const p = await analyzeRepository(gh, value, (prog: AnalysisProgress) => {
        setLines((ls) => [
          ...ls.filter((l) => l.stepId !== prog.phase),
          { stepId: prog.phase, message: prog.message, status: prog.done ? "ok" : "run" },
        ]);
      });
      setProfile(p);
      setLines((ls) => [...ls, { stepId: "done", message: "Analysis complete — create a workspace to run full discovery", status: "ok" }]);
      setPhase("done");
    } catch (err) {
      const msg = err instanceof GitHubApiError ? err.message : "Unexpected error while analyzing.";
      setError(msg);
      setLines((ls) => [...ls, { stepId: "err", message: msg, status: "err" }]);
      setPhase("err");
    }
  };

  return (
    <section id="top" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-14 md:grid-cols-[1.05fr_1fr] md:px-6 md:pt-20">
      <div className="reveal">
        <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-signal-400">
          <span className="size-1.5 rounded-full bg-signal-400 pulse-dot" />
          open-source user discovery
        </p>
        <h1 className="font-display text-[40px] font-extrabold leading-[1.04] tracking-tight text-fog-100 md:text-[58px]">
          Your next ten users are{" "}
          <span className="relative inline-block text-signal-400">
            already asking
            <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 220 8" aria-hidden="true"><path d="M2 6C60 1 160 1 218 5" stroke="#f2a93b" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".5" /></svg>
          </span>{" "}
          for this.
        </h1>
        <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-fog-300">
          Point UserScout at your GitHub repo. It reads what you built, works out who it's for, then finds people with{" "}
          <em className="not-italic text-fog-100">public evidence</em> they need it — and explains every score, point by point.
        </p>
        <ul className="mt-6 space-y-2 text-[13.5px] text-fog-400">
          {["No mass outreach. Ever. A human writes every message.", "Deterministic scoring — same input, same result.", "Only public GitHub data; your CRM stays on your device."].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-leaf-400"><ICheck size={14} /></span>
              {t}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={signedIn ? "/app/projects/new" : "/auth?mode=register"}>
            <Button>Add your project <IArrowR size={14} /></Button>
          </Link>
          <a href="#scoring" className="rounded-md border border-pine-600 px-4 py-2.5 text-sm font-medium text-fog-300 transition-colors hover:border-signal-500/60 hover:text-signal-300">
            How scoring works
          </a>
        </div>
      </div>

      {/* console */}
      <div className="brackets reveal rounded-lg border border-pine-600 bg-pine-900/85 shadow-panel" style={{ animationDelay: "120ms" }}>
        <div className="flex items-center justify-between border-b border-pine-700 px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fog-400">
            <ITerminal size={13} /> scout console
          </span>
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-pine-600" /><span className="size-2 rounded-full bg-pine-600" /><span className="size-2 rounded-full bg-signal-500/70" />
          </span>
        </div>
        <div className="p-4">
          <form onSubmit={run} className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="github.com/owner/repo — try it live"
              aria-label="GitHub repository URL"
              spellCheck={false}
              className="font-mono text-[13px]"
            />
            <Button type="submit" loading={phase === "run"} disabled={!value.trim()}>
              <ISearch size={14} /> Scout
            </Button>
          </form>

          <div className="mt-4 flex gap-4">
            <div className="hidden sm:block"><Radar active={phase === "run" || phase === "done"} size={116} blips={profile ? 5 : 3} /></div>
            <div className="min-w-0 flex-1">
              <ConsoleLog lines={lines} className="h-[132px]" />
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-md border border-ember-500/35 bg-ember-500/10 px-3 py-2.5 text-[12.5px] text-ember-400">
              <IAlert size={15} className="mt-px shrink-0" /> {error}
            </div>
          )}

          {profile && (
            <div className="reveal mt-4 space-y-3 rounded-md border border-pine-700 bg-pine-950/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a href={profile.url} target="_blank" rel="noopener noreferrer" className="font-display text-[16px] font-bold text-fog-100 hover:text-signal-300">
                    {profile.fullName}
                  </a>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fog-400">{profile.description || "No description"}</p>
                </div>
                <Badge tone="green" className="shrink-0 font-mono"><IStar size={10} /> {formatNumber(profile.stars)}</Badge>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-fog-500">Derived keywords</div>
                <div className="flex flex-wrap gap-1.5">{profile.keywords.slice(0, 6).map((k) => <Chip key={k}>{k}</Chip>)}</div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-fog-500">Likely audience</div>
                <ul className="space-y-1 text-[12.5px] text-fog-300">
                  {profile.audience.slice(0, 3).map((a) => (
                    <li key={a} className="flex items-start gap-2"><span className="mt-1.5 size-1 rounded-full bg-signal-400" />{a}</li>
                  ))}
                </ul>
              </div>
              <Link to={signedIn ? "/app/projects/new" : "/auth?mode=register"} className="block">
                <Button className="w-full">Create a workspace → run full discovery</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Signal hierarchy ── */

const STRONG = [
  { icon: IIssue, t: "Publicly asks for a solution", d: "Open issues phrased as questions about your exact problem." },
  { icon: IUsers, t: "Maintains a closely related project", d: "Their repo's description or topics match your query terms." },
  { icon: IBranch, t: "Contributes to related projects", d: "Recent commits in the nearest neighbouring repos." },
  { icon: IFlag, t: "Requests an alternative", d: "“Alternative to X”, “replacement for X” — public intent." },
];
const WEAK = [
  { icon: ILock, t: "Uses the same language", d: "Necessary context, never proof of need." },
  { icon: IEye, t: "Generally relevant profile", d: "Bio or topics brush past your space." },
  { icon: ICompass, t: "Recently active", d: "Recency adjusts a score; it doesn't create one." },
];

function SignalHierarchy() {
  return (
    <section id="signals" className="border-y border-pine-800 bg-pine-900/40 py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHead kicker="signal model" title="Evidence first, always." body="UserScout ranks people by what they've publicly done, not by who they are. Strong signals can carry a score alone; weak signals can only nudge one." />
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="rounded-lg border border-leaf-500/25 bg-pine-900/70 p-6">
            <Badge tone="green" className="font-mono">STRONG · up to +70</Badge>
            <ul className="mt-5 space-y-4">
              {STRONG.map((s) => (
                <li key={s.t} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-leaf-500/30 bg-leaf-500/10 text-leaf-300"><s.icon size={15} /></span>
                  <div><div className="text-[14px] font-semibold text-fog-100">{s.t}</div><div className="mt-0.5 text-[12.5px] leading-relaxed text-fog-400">{s.d}</div></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-pine-600 bg-pine-900/70 p-6">
            <Badge tone="fog" className="font-mono">WEAK · up to +43, capped low</Badge>
            <ul className="mt-5 space-y-4">
              {WEAK.map((s) => (
                <li key={s.t} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-pine-600 bg-pine-800 text-fog-400"><s.icon size={15} /></span>
                  <div><div className="text-[14px] font-semibold text-fog-100">{s.t}</div><div className="mt-0.5 text-[12.5px] leading-relaxed text-fog-400">{s.d}</div></div>
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-md border border-pine-700 bg-pine-950/60 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-fog-400">
              weak-only ceiling = 43/100 → always LOW confidence
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {[
            { tag: "BAD", tone: "red" as const, txt: "“Python developer → potential user.”" },
            { tag: "GOOD", tone: "amber" as const, txt: "“Maintains a Python project related to the problem this project solves.”" },
            { tag: "BETTER", tone: "green" as const, txt: "“Public activity indicates they are looking for a solution to this problem.”" },
          ].map((x) => (
            <div key={x.tag} className="rounded-md border border-pine-700 bg-pine-900/70 p-4">
              <Badge tone={x.tone} className="font-mono">{x.tag}</Badge>
              <p className="mt-2.5 text-[13px] leading-relaxed text-fog-300">{x.txt}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Interactive scoring demo ── */

const DEMO_DEFAULTS: Record<string, boolean> = { asking: true, maintainer: true, tech: true, recency: true, contributor: false, audience: false };

function ScoringDemo() {
  const [sel, setSel] = useState(DEMO_DEFAULTS);
  const { score, confidence, parts } = useMemo(() => {
    const pts: Record<string, number> = { asking: 30, maintainer: 25, contributor: 15, tech: 20, recency: 15, audience: 8 };
    const parts = SIGNAL_DOCS.filter((s) => sel[s.id]).map((s) => ({ label: s.label, points: pts[s.id] }));
    const raw = parts.reduce((a, b) => a + b.points, 0);
    const score = clamp(raw, 0, 100);
    const strong = sel.asking || sel.maintainer || sel.contributor;
    const veryStrong = sel.asking || sel.maintainer;
    const confidence = score >= 70 && veryStrong ? "high" : score >= 45 || strong ? "medium" : "low";
    return { score, confidence, parts };
  }, [sel]);

  return (
    <section id="scoring" className="py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHead kicker="transparent scoring" title="Every point has a receipt." body="Scores are a deterministic sum of documented signals. Toggle signals below — the demo uses the exact weights the product ships with." />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SIGNAL_DOCS.map((s) => {
              const on = sel[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setSel((v) => ({ ...v, [s.id]: !v[s.id] }))}
                  aria-pressed={on}
                  className={cx(
                    "rounded-md border p-4 text-left transition-all duration-150",
                    on ? "border-signal-500/50 bg-signal-500/[0.07] shadow-[0_0_0_1px_rgba(242,169,59,0.15)]" : "border-pine-700 bg-pine-900/60 hover:border-pine-600",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cx("text-[13.5px] font-semibold", on ? "text-fog-100" : "text-fog-400")}>{s.label}</span>
                    <span className={cx("font-mono text-[11.5px] font-bold", on ? "text-signal-300" : "text-fog-500")}>+{s.max}</span>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog-500">{s.rule}</p>
                </button>
              );
            })}
          </div>
          <div className="brackets flex flex-col items-center justify-center gap-4 rounded-lg border border-pine-600 bg-pine-900/80 p-7">
            <ScoreDial score={score} size={132} sub={bandOf(score)} />
            <ConfidenceBadge c={confidence as "low" | "medium" | "high"} />
            <div className="w-full space-y-1.5 border-t border-pine-700 pt-4 font-mono text-[11.5px]">
              {parts.map((p) => (
                <div key={p.label} className="flex justify-between text-fog-400"><span>{p.label.toLowerCase()}</span><span className="text-leaf-300">+{p.points}</span></div>
              ))}
              <div className="flex justify-between border-t border-pine-700 pt-1.5 font-semibold text-fog-100"><span>total (capped)</span><span>{score}/100</span></div>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-fog-500">Deterministic & testable. Same evidence in → same score out. No black box.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── The loop ── */

function LoopSection() {
  return (
    <section className="border-y border-pine-800 bg-pine-900/40 py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHead kicker="the whole loop" title="From repo to retained user." body="One pipeline, tracked honestly. Metrics shown in the workspace are computed from your own records — never invented." />
        <ol className="mt-9 flex gap-2 overflow-x-auto pb-3 slim-scroll" aria-label="Product flow pipeline">
          {PIPELINE.map((step, i) => (
            <li key={step} className="flex shrink-0 items-center gap-2">
              <span className={cx(
                "flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[11.5px]",
                i === 0 ? "border-signal-500/50 bg-signal-500/10 text-signal-300" : i === PIPELINE.length - 1 ? "border-leaf-500/50 bg-leaf-500/10 text-leaf-300" : "border-pine-600 bg-pine-900/80 text-fog-300",
              )}>
                <span className="text-fog-500">{String(i + 1).padStart(2, "0")}</span>
                {step}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-pine-500"><IArrowR size={12} /></span>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Ethics ── */

function EthicsSection() {
  const yes = [
    "Surfaces only public GitHub activity, via the official API",
    "Explains every recommendation with links to the evidence",
    "Leaves the decision — and the message — to a human",
    "Stores notes & outreach history privately on your device",
  ];
  const no = [
    "No automatic emails or bulk messaging",
    "No scraping of private data or bypassing auth",
    "No selling or sharing of personal information",
    "No dark patterns, no fabricated social proof",
  ];
  return (
    <section id="ethics" className="py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1fr_1fr_1fr] md:px-6">
        <div>
          <SectionHead kicker="hard limits" title="Built to find users, not to spam." body="UserScout exists because cold mass-outreach is broken. It will never become the thing it's trying to replace." compact />
          <div className="mt-6 flex items-center gap-2.5 rounded-md border border-pine-700 bg-pine-900/70 px-4 py-3 text-[12.5px] text-fog-400">
            <IShield size={16} className="shrink-0 text-signal-400" />
            The person you're writing to is the point — personalization over volume.
          </div>
        </div>
        <div className="rounded-lg border border-leaf-500/25 bg-pine-900/70 p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-leaf-300"><IHand size={14} /> does</div>
          <ul className="space-y-2.5">
            {yes.map((t) => <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-fog-300"><span className="mt-0.5 shrink-0 text-leaf-400"><ICheck size={14} /></span>{t}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border border-ember-500/25 bg-pine-900/70 p-5">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ember-400"><IZap size={14} /> refuses to</div>
          <ul className="space-y-2.5">
            {no.map((t) => <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed text-fog-300"><span className="mt-0.5 shrink-0 text-ember-400"><IX size={14} /></span>{t}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ kicker, title, body, compact }: { kicker: string; title: string; body: string; compact?: boolean }) {
  return (
    <div className={compact ? "max-w-sm" : "max-w-2xl"}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal-400">{kicker}</p>
      <h2 className={cx("mt-2.5 font-display font-extrabold tracking-tight text-fog-100", compact ? "text-[26px]" : "text-[32px] md:text-[38px]")}>{title}</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-fog-400">{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-pine-800 py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="font-mono text-[11px] text-fog-500">MIT licensed · open source</span>
        </div>
        <div className="flex items-center gap-5 text-[12px] text-fog-500">
          <a href="#signals" className="hover:text-fog-200">Signals</a>
          <a href="#scoring" className="hover:text-fog-200">Scoring</a>
          <a href="#ethics" className="hover:text-fog-200">Ethics</a>
          <Link to="/auth" className="hover:text-fog-200">Workspace</Link>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 md:w-auto md:justify-end">
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-fog-500">
            <IZip size={12} className="text-signal-400/80" /> userscout-source.zip · {sourceFileCount()} files · MIT
          </span>
          <span className="sm:hidden"><DownloadButton /></span>
        </div>
        <p className="w-full font-mono text-[10.5px] text-fog-500 md:w-auto">local-first build — accounts & CRM live in your browser, not on a server</p>
      </div>
    </footer>
  );
}
