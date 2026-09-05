/* Domain widgets: score dial, signal breakdown, radar, funnel, console. */

import { useState, type ReactNode } from "react";
import type { DiscoveryProgress, Evidence, RateInfo, Signal } from "../core/types";
import { bandOf } from "../core/scoring";
import { copyText, cx } from "../core/utils";
import { ICheck, ICopy, IExt } from "./icons";
import { Badge } from "./ui";

const BAND_COLOR: Record<string, string> = { high: "#7cc98f", medium: "#f2a93b", low: "#7e9482" };

export function ScoreDial({ score, size = 76, sub }: { score: number; size?: number; sub?: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, score)) / 100) * c;
  const band = bandOf(score);
  const color = BAND_COLOR[band];
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 76 76" aria-label={`Score ${score} out of 100`}>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#223127" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 38 38)"
          className="dial-arc"
          style={{ ["--dial-c" as string]: c }}
        />
        <text x="38" y="37" textAnchor="middle" fill="#eef3ea" fontSize="19" fontWeight="700" fontFamily="Bricolage Grotesque, sans-serif">
          {score}
        </text>
        <text x="38" y="50" textAnchor="middle" fill="#7e9482" fontSize="8.5" fontFamily="ui-monospace, monospace">
          /100
        </text>
      </svg>
      {sub && <span className="mt-1 font-mono text-[9px] uppercase tracking-widest" style={{ color }}>{sub}</span>}
    </div>
  );
}

export function SignalBreakdown({ signals, compact }: { signals: Signal[]; compact?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {signals.map((s) => (
        <li key={s.id} className="border-b border-pine-700/70 px-1 py-2.5 last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-fog-200">{s.label}</span>
            <span className="font-mono text-[11.5px] font-semibold text-leaf-300">+{s.points}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-pine-700">
            <div className="h-full rounded-full bg-gradient-to-r from-leaf-500 to-leaf-300 transition-all duration-700" style={{ width: `${(s.points / s.maxPoints) * 100}%` }} />
          </div>
          {!compact &&
            s.evidence.map((e, i) => (
              <p key={i} className="mt-1.5 text-[12px] leading-relaxed text-fog-400">
                <span className="text-fog-500">â†³ </span>
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-tide-400 underline-offset-2 hover:underline">
                    {e.text}
                  </a>
                ) : (
                  e.text
                )}
              </p>
            ))}
        </li>
      ))}
      {!signals.length && <li className="rounded-md border border-dashed border-pine-600 px-3 py-2 text-[12px] text-fog-500">No positive signals recorded.</li>}
    </ul>
  );
}

export function EvidenceRow({ e }: { e: Evidence }) {
  const kindTone = { issue: "amber", repo: "teal", contribution: "green", profile: "fog" } as const;
  const kindLabel = { issue: "discussion", repo: "related repo", contribution: "contribution", profile: "profile" } as const;
  return (
    <li className="flex items-start gap-2.5 border-b border-pine-700/60 px-1 py-2.5 last:border-b-0">
      <Badge tone={kindTone[e.kind]} className="mt-px shrink-0 uppercase font-mono text-[9px]">{kindLabel[e.kind]}</Badge>
      <div className="min-w-0 text-[13px] leading-relaxed text-fog-200">
        {e.text}
        {e.url && (
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-tide-400 hover:underline">
            view <IExt size={10} />
          </a>
        )}
      </div>
    </li>
  );
}

/* â”€â”€ Radar (decorative, ambient) â”€â”€ */

export function Radar({ active, size = 168, blips = 3 }: { active?: boolean; size?: number; blips?: number }) {
  const blipPos = [
    [62, 30],
    [30, 62],
    [70, 66],
    [44, 42],
    [58, 52],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <circle cx="50" cy="50" r="47" fill="#101813" stroke="#2e4234" strokeWidth="1" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="#223127" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="21" fill="none" stroke="#223127" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="9" fill="none" stroke="#223127" strokeWidth="0.8" />
      <path d="M50 3v94M3 50h94" stroke="#1d2a21" strokeWidth="0.6" />
      {active && (
        <g className="radar-sweep">
          <path d="M50 50 L50 3 A47 47 0 0 1 78 11 Z" fill="url(#sweepGrad)" opacity=".5" />
          <line x1="50" y1="50" x2="50" y2="3" stroke="#f2a93b" strokeWidth="1.2" opacity=".9" />
        </g>
      )}
      <defs>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2a93b" stopOpacity=".55" />
          <stop offset="100%" stopColor="#f2a93b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {blipPos.slice(0, blips).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" fill={i === 0 ? "#f2a93b" : "#7cc98f"} className={active ? "radar-blip" : undefined} style={{ animationDelay: `${i * 0.7}s`, opacity: active ? undefined : 0.35 }} />
      ))}
      <circle cx="50" cy="50" r="2" fill="#f2a93b" />
    </svg>
  );
}

/* â”€â”€ Funnel â”€â”€ */

export function FunnelViz({ stages }: { stages: { id: string; label: string; count: number; rate: number | null }[] }) {
  const max = Math.max(1, stages[0]?.count ?? 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.id} className="group flex items-center gap-3">
          <span className="w-[104px] shrink-0 text-right text-[11.5px] text-fog-400">{s.label}</span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-pine-900/70 border border-pine-700/50">
            <div
              className={cx("h-full rounded-sm transition-all duration-700", i === stages.length - 1 ? "bg-leaf-500/75" : "bg-signal-500/65 group-hover:bg-signal-500/85")}
              style={{ width: `${Math.max(s.count > 0 ? 4 : 0, (s.count / max) * 100)}%` }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center font-mono text-[11px] font-semibold text-fog-100">{s.count}</span>
          </div>
          <span className="w-14 shrink-0 font-mono text-[10.5px] text-fog-500">{s.rate === null ? "" : `${Math.round(s.rate * 100)}%`}</span>
        </div>
      ))}
    </div>
  );
}

/* â”€â”€ Rate-limit chip â”€â”€ */

export function RateChip({ rate }: { rate: RateInfo }) {
  const search = rate.searchRemaining;
  const core = rate.coreRemaining;
  if (search === null && core === null) return null;
  const low = (search !== null && search <= 2) || (core !== null && core <= 5);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px]",
        low ? "border-ember-500/40 bg-ember-500/10 text-ember-400" : "border-pine-600 bg-pine-800/70 text-fog-400",
      )}
      title="GitHub API requests remaining (unauthenticated: 60/h core, 10/min search)"
    >
      <span className={cx("size-1.5 rounded-full", low ? "bg-ember-400" : "bg-leaf-400 pulse-dot")} />
      GH {core ?? "â€“"}Â·S {search ?? "â€“"}
    </span>
  );
}

/* â”€â”€ Copy button with feedback â”€â”€ */

export function CopyButton({ text, label = "Copy", size = "md" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md border font-medium transition-all",
        size === "sm" ? "h-7 px-2 text-[11.5px]" : "h-9 px-3 text-[12.5px]",
        copied ? "border-leaf-500/50 bg-leaf-500/12 text-leaf-300" : "border-pine-600 bg-pine-800/60 text-fog-300 hover:border-signal-500/60 hover:text-signal-300",
      )}
    >
      {copied ? <ICheck size={13} /> : <ICopy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* â”€â”€ Avatar with graceful fallback â”€â”€ */

export function Avatar({ url, login, size = 36 }: { url: string; login: string; size?: number }) {
  const [err, setErr] = useState(false);
  return err || !url ? (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-pine-600 bg-pine-700 font-mono font-semibold text-signal-300"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {login.slice(0, 2).toUpperCase()}
    </span>
  ) : (
    <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setErr(true)} className="shrink-0 rounded-full border border-pine-600" style={{ width: size, height: size }} />
  );
}

/* â”€â”€ Discovery console log â”€â”€ */

export function ConsoleLog({ lines, className }: { lines: DiscoveryProgress[]; className?: string }) {
  return (
    <div className={cx("scanlines rounded-md border border-pine-700 bg-pine-950/90 p-3 font-mono text-[11.5px] leading-relaxed slim-scroll max-h-64 overflow-y-auto", className)}>
      {lines.map((l, i) => (
        <div key={i} className="reveal flex items-start gap-2 py-0.5">
          <span className={cx("mt-[3px] size-1.5 shrink-0 rounded-full", l.status === "run" ? "bg-signal-400 animate-pulse" : l.status === "ok" ? "bg-leaf-400" : l.status === "warn" ? "bg-signal-500" : "bg-ember-400")} />
          <span className={l.status === "err" ? "text-ember-400" : "text-fog-300"}>
            <span className="text-fog-500">$ </span>
            {l.message}
            {l.status === "run" && <span className="cursor-blink text-signal-400">â–Œ</span>}
          </span>
        </div>
      ))}
      {!lines.length && (
        <div className="text-fog-500">
          <span className="text-fog-500">$ </span>awaiting discovery runâ€¦<span className="cursor-blink text-signal-400">â–Œ</span>
        </div>
      )}
    </div>
  );
}

/* â”€â”€ Stat block â”€â”€ */

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border border-pine-700/70 bg-pine-900/50 px-3.5 py-3">
      <div className={cx("font-display text-[22px] font-bold leading-none", accent ? "text-signal-400" : "text-fog-100")}>{value}</div>
      <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wider text-fog-500">{label}</div>
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded border border-pine-600 bg-pine-800/70 px-2 py-0.5 font-mono text-[11px] text-fog-300">{children}</span>;
}

