/* UI primitives — buttons, fields, modal, tabs, empty states. */

import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "../core/utils";
import { IX } from "./icons";
import type { ProspectStatus } from "../core/types";
import { statusLabel } from "../core/types";

/* ── Button ── */

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "subtle";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 select-none whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";
  const sizes = size === "sm" ? "min-h-8 px-3 text-[12.5px]" : "min-h-10 px-4 text-sm";
  const variants: Record<BtnVariant, string> = {
    primary: "bg-signal-500 text-signal-950 hover:bg-signal-400 shadow-[0_2px_10px_-5px_rgba(242,169,59,.55)]",
    outline: "border border-pine-600 text-fog-100 hover:border-signal-500/70 hover:text-signal-300 bg-pine-800/55",
    ghost: "text-fog-300 hover:bg-pine-800 hover:text-fog-100",
    danger: "bg-ember-500/12 text-ember-400 border border-ember-500/35 hover:bg-ember-500/22",
    subtle: "bg-pine-700 text-fog-100 hover:bg-pine-600",
  };
  return (
    <button className={cx(base, sizes, variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className ?? "size-4")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ── Fields ── */

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-medium text-fog-300">
        {label}
        {hint && <span className="text-[11px] font-normal text-fog-500">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[12px] text-ember-400">{error}</span>}
    </label>
  );
}

const fieldCls =
  "w-full h-10 rounded-md border border-pine-600 bg-pine-950/65 px-3 text-sm text-fog-100 placeholder:text-fog-500 transition-colors focus:border-signal-500 focus:outline-none focus:ring-2 focus:ring-signal-500/15";

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx(fieldCls, invalid && "border-ember-500/60", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldCls, "h-auto min-h-[96px] py-2 leading-relaxed slim-scroll", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldCls, "appearance-none pr-8 bg-no-repeat bg-[right_10px_center] cursor-pointer", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237e9482' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M6 9.5 12 15.5 18 9.5'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ── Badges / pills ── */

export type Tone = "amber" | "green" | "red" | "teal" | "fog" | "pine";

const tones: Record<Tone, string> = {
  amber: "bg-signal-500/12 text-signal-300 border-signal-500/30",
  green: "bg-leaf-500/12 text-leaf-300 border-leaf-500/30",
  red: "bg-ember-500/12 text-ember-400 border-ember-500/30",
  teal: "bg-tide-500/12 text-tide-400 border-tide-500/30",
  fog: "bg-pine-700/70 text-fog-300 border-pine-600",
  pine: "bg-pine-800 text-fog-400 border-pine-700",
};

export function Badge({ tone = "fog", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10.5px] font-medium tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<ProspectStatus, Tone> = {
  saved: "fog",
  contacted: "teal",
  replied: "amber",
  tried: "amber",
  feedback: "teal",
  user: "green",
  not_interested: "red",
  archived: "pine",
};

export function StatusPill({ status, className }: { status: ProspectStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      <span className={cx("size-1.5 rounded-full", {
        saved: "bg-fog-400",
        fog: "bg-fog-400",
        contacted: "bg-tide-400",
        replied: "bg-signal-400",
        tried: "bg-signal-400",
        feedback: "bg-tide-400",
        user: "bg-leaf-400 pulse-dot",
        not_interested: "bg-ember-400",
        archived: "bg-fog-500",
      }[status])} />
      {statusLabel(status)}
    </Badge>
  );
}

export function ConfidenceBadge({ c }: { c: "low" | "medium" | "high" }) {
  const map = { high: ["green", "HIGH RELEVANCE"], medium: ["amber", "MEDIUM"], low: ["fog", "LOW — WEAK SIGNALS ONLY"] } as const;
  return <Badge tone={map[c][0]} className="font-mono uppercase tracking-wider text-[10px]">{map[c][1]}</Badge>;
}

/* ── Modal ── */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = [...ref.current.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")]
        .filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button, [href], input, textarea, select")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pine-950/80 p-4 pt-[9vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={cx("reveal w-full rounded-lg border border-pine-600 bg-pine-850 shadow-panel", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-pine-700 px-5 py-3.5">
          <h2 id="modal-title" className="font-display text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-fog-400 hover:bg-pine-700 hover:text-fog-100" aria-label="Close dialog">
            <IX size={15} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Tabs ── */

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-pine-700">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "relative -mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
            active === t.id ? "border-signal-500 text-signal-300" : "border-transparent text-fog-400 hover:text-fog-100",
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className={cx("rounded px-1.5 py-px font-mono text-[10px]", active === t.id ? "bg-signal-500/15 text-signal-300" : "bg-pine-700 text-fog-400")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label || "Toggle setting"}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-2.5 text-[13px] text-fog-300 hover:text-fog-100"
    >
      <span className={cx("relative h-5 w-9 rounded-full border transition-colors", checked ? "border-leaf-500/60 bg-leaf-500/25" : "border-pine-600 bg-pine-800")}>
        <span className={cx("absolute top-0.5 size-3.5 rounded-full transition-all", checked ? "left-[18px] bg-leaf-400" : "left-0.5 bg-fog-500 group-hover:bg-fog-400")} />
      </span>
      {label}
    </button>
  );
}

/* ── Empty / loading states ── */

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-pine-700/80 bg-pine-900/45 px-6 py-12 text-center shadow-soft">
      <div className="mb-4 flex size-11 items-center justify-center rounded-md border border-pine-600 bg-pine-800 text-signal-400">{icon}</div>
      <h3 className="font-display text-[16px] font-semibold text-fog-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fog-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md border border-pine-700/60 bg-pine-800/60" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-pine-600 bg-pine-800 px-1.5 py-0.5 font-mono text-[10px] text-fog-300">{children}</kbd>;
}
