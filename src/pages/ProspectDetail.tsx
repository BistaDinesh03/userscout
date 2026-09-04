/* Prospect detail — evidence, outreach timeline, notes, draft, feedback.
 * Nothing here sends a message. Humans decide, humans write, humans send. */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { DraftChannel, ProspectStatus } from "../core/types";
import { STATUSES, statusLabel } from "../core/types";
import { useWorkspace } from "../state/store";
import { PageHead } from "../components/layout";
import { Avatar, CopyButton, EvidenceRow, ScoreDial, SignalBreakdown } from "../components/bits";
import { IAlert, IArrowL, ICheck, IClock, IExt, IFlag, IInbox, INote, ISend, IStar, ITerminal, IUsers } from "../components/icons";
import { Badge, Button, ConfidenceBadge, EmptyState, Field, Select, StatusPill, Textarea } from "../components/ui";
import { cx, formatDate, formatClock, timeAgo } from "../core/utils";

const NEXT_STEP: Partial<Record<ProspectStatus, { to: ProspectStatus; label: string }>> = {
  saved: { to: "contacted", label: "Mark contacted" },
  contacted: { to: "replied", label: "They replied" },
  replied: { to: "tried", label: "They tried the project" },
  tried: { to: "feedback", label: "Log feedback" },
  feedback: { to: "user", label: "Mark as user" },
};

export default function ProspectDetail() {
  const { pid } = useParams<{ pid: string }>();
  const { prospects, projects, events, drafts, feedback, user, setStatus, addNote, saveDraft, saveFeedback, toast } = useWorkspace();

  const prospect = prospects.find((p) => p.id === pid);
  const project = projects.find((p) => p.id === prospect?.projectId);

  const [note, setNote] = useState("");
  const [draftBody, setDraftBody] = useState<string | null>(null);
  const [draftChannel, setDraftChannel] = useState<DraftChannel | null>(null);
  const [fb, setFb] = useState({ rating: 0, useful: "", confusing: "", improve: "", wouldUseAgain: "maybe" as "yes" | "no" | "maybe", notes: "" });
  const [fbTouched, setFbTouched] = useState(false);

  const timeline = useMemo(() => events.filter((e) => e.prospectId === pid).sort((a, b) => b.at - a.at), [events, pid]);
  const draft = drafts.find((d) => d.prospectId === pid);
  const fbEntry = feedback.find((f) => f.prospectId === pid);

  const body = draftBody ?? draft?.body ?? "";
  const channel = draftChannel ?? draft?.channel ?? "github";

  if (!prospect || !project) {
    return (
      <EmptyState icon={<IAlert size={20} />} title="Prospect not found" body="It may belong to another project that was deleted, or to another account on this device."
        action={<Link to="/app/outreach"><Button><IArrowL size={13} /> Outreach workspace</Button></Link>} />
    );
  }

  const evidenceLines = prospect.signals
    .filter((s) => ["asking", "maintainer", "contributor"].includes(s.id))
    .flatMap((s) => s.evidence.map((e) => e.text.replace(/\s*\(.*ago\)\.?$/, "")))
    .slice(0, 3);

  const buildTemplate = () => {
    const name = prospect.name ? ` (${prospect.name})` : "";
    const lines = [
      `Hi @${prospect.login}${name},`,
      ``,
      `I'm building ${project.profile.fullName}${project.profile.description ? ` — ${project.profile.description.toLowerCase().replace(/\.$/, "")}` : ""}.`,
      `I found your profile while looking for people genuinely close to this problem:`,
      ``,
      ...evidenceLines.map((e) => `• ${e}`),
      ``,
      `If this is still a live problem for you, I'd value a brutally honest first impression. No follow-up cadence, no drip sequence — one human asking another.`,
      ``,
      `— ${user?.username ?? "me"}`,
    ];
    return lines.join("\n");
  };

  const persistDraft = (b: string, c: DraftChannel) => {
    saveDraft(prospect.id, c, b);
    toast("ok", "Draft saved privately on this device.");
  };

  const next = NEXT_STEP[prospect.status];

  return (
    <>
      <PageHead
        title={`@${prospect.login}`}
        sub={prospect.bio || `Public profile: github.com/${prospect.login}`}
        right={<Link to={`/app/projects/${project.id}`}><Button variant="ghost" size="sm"><IArrowL size={13} /> {project.profile.repo}</Button></Link>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-pine-700/80 bg-pine-900/60 p-4">
        <div className="flex items-center gap-4">
          <Avatar url={prospect.avatarUrl} login={prospect.login} size={52} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={prospect.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-display text-[18px] font-bold text-fog-100 hover:text-signal-300">
                {prospect.login} <IExt size={13} className="text-fog-500" />
              </a>
              <ConfidenceBadge c={prospect.confidence} />
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-fog-500">
              first seen {timeAgo(prospect.firstSeenAt)} · sources: {prospect.sources.join(", ")}
            </div>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-4 sm:ml-auto sm:w-auto sm:justify-start sm:gap-5">
          <ScoreDial score={prospect.score} size={72} sub={prospect.confidence} />
          <div className="flex min-w-0 flex-1 flex-col items-end gap-2 sm:flex-none">
            <StatusPill status={prospect.status} />
            <Select value={prospect.status} onChange={(e) => { setStatus(prospect.id, e.target.value as ProspectStatus); toast("ok", `Status → ${statusLabel(e.target.value as ProspectStatus)}`); }} aria-label="Change prospect status" className="h-8 w-full text-[12.5px] sm:w-44">
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* LEFT — why this person */}
        <div className="space-y-5">
          <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-bold">Why this person?</h2>
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-fog-500">deterministic breakdown</span>
            </div>
            <p className="mb-4 rounded-md border border-pine-700 bg-pine-950/50 px-3.5 py-3 text-[13px] leading-relaxed text-fog-200">{prospect.explanation}</p>
            <SignalBreakdown signals={prospect.signals} />
          </section>

          <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
            <h2 className="mb-3 font-display text-[15px] font-bold">Evidence ({prospect.signals.reduce((n, s) => n + s.evidence.length, 0)})</h2>
            <ul className="space-y-2">
              {prospect.signals.flatMap((s) => s.evidence).map((e, i) => <EvidenceRow key={i} e={e} />)}
            </ul>
            <p className="mt-3 font-mono text-[10px] leading-relaxed text-fog-500">Every item links to public GitHub activity. Verify before you write — personalization beats volume.</p>
          </section>
        </div>

        {/* RIGHT — outreach workspace */}
        <div className="space-y-5">
          <section className="brackets rounded-lg border border-pine-600 bg-pine-900/80 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold"><ISend size={14} className="text-signal-400" /> Personal outreach</h2>
              <Badge tone="pine" className="font-mono">never auto-sent</Badge>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" variant="subtle" onClick={() => { setDraftBody(buildTemplate()); setDraftChannel(channel); }}>
                <ITerminal size={12} /> Draft from evidence
              </Button>
              {next && next.to !== "feedback" && (
                <Button size="sm" variant="outline" onClick={() => { setStatus(prospect.id, next.to, { channel: next.to === "contacted" ? channel : undefined }); toast("ok", `Status → ${statusLabel(next.to)}`); }}>
                  <ICheck size={12} /> {next.label}
                </Button>
              )}
              {next?.to === "feedback" && <Button size="sm" variant="outline" onClick={() => document.getElementById("feedback-form")?.scrollIntoView({ behavior: "smooth" })}><INote size={12} /> Log feedback</Button>}
              {prospect.status !== "not_interested" && prospect.status !== "archived" && (
                <Button size="sm" variant="ghost" onClick={() => { setStatus(prospect.id, "not_interested"); toast("info", "Marked not interested — they stay out of your funnel."); }}>
                  <IFlag size={12} /> Not interested
                </Button>
              )}
            </div>

            <div className="mb-2 flex items-center gap-2">
              <Select value={channel} onChange={(e) => { setDraftChannel(e.target.value as DraftChannel); if (body) persistDraft(body, e.target.value as DraftChannel); }} aria-label="Contact channel" className="h-8 w-36 text-[12px]">
                <option value="github">GitHub</option>
                <option value="email">Email</option>
                <option value="chat">Chat / DM</option>
                <option value="other">Other</option>
              </Select>
              <span className="font-mono text-[10px] text-fog-500">where you'll send it yourself</span>
            </div>

            <Textarea
              value={body}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Write something only you could write. Reference their issue, their repo, their words."
              aria-label="Outreach draft"
              className="min-h-[180px] font-mono text-[12.5px]"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <CopyButton text={body} label="Copy message" size="sm" />
              <Button size="sm" variant="ghost" onClick={() => persistDraft(body, channel)} disabled={body === (draft?.body ?? "") && (draftChannel === null || draftChannel === draft?.channel)}>
                Save draft
              </Button>
              {prospect.status === "saved" && body.trim() && (
                <Button size="sm" variant="outline" onClick={() => { persistDraft(body, channel); setStatus(prospect.id, "contacted", { channel }); toast("ok", "Marked contacted — now send it from your own account, in your own words."); }}>
                  <ISend size={12} /> Saved + mark contacted
                </Button>
              )}
              <span className="ml-auto font-mono text-[9.5px] text-fog-500">{body.length}/5000</span>
            </div>
          </section>

          {/* timeline */}
          <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold"><IClock size={14} className="text-signal-400" /> Timeline</h2>
            <div className="mb-4 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && note.trim()) {
                    addNote(prospect.id, note);
                    setNote("");
                    toast("ok", "Private note added.");
                  }
                }}
                placeholder="Add a private note… (Enter to save)"
                aria-label="Private note"
                className="h-9 flex-1 rounded-md border border-pine-600 bg-pine-950/70 px-3 text-[12.5px] text-fog-100 placeholder:text-fog-500 focus:border-signal-500 focus:outline-none"
              />
            </div>
            {timeline.length === 0 ? (
              <p className="text-[12.5px] text-fog-500">No activity yet — notes, status changes and feedback land here.</p>
            ) : (
              <ol className="relative space-y-3.5 border-l border-pine-700 pl-4">
                {[...timeline].reverse().map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className={cx("absolute -left-[21.5px] top-1 size-2.5 rounded-full border-2 border-pine-900",
                      ev.type === "status" ? "bg-signal-400" : ev.type === "feedback" ? "bg-tide-400" : ev.type === "note" ? "bg-leaf-400" : "bg-pine-500")} />
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-fog-500">{ev.type}{ev.channel ? ` · ${ev.channel}` : ""}</span>
                      <span className="shrink-0 font-mono text-[10px] text-fog-500" title={formatClock(ev.at)}>{formatDate(ev.at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fog-200">{ev.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* feedback */}
          <section id="feedback-form" className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold"><IInbox size={14} className="text-signal-400" /> Feedback received</h2>
              {fbEntry && <Badge tone="teal" className="font-mono">logged {timeAgo(fbEntry.at)}</Badge>}
            </div>
            {fbEntry && !fbTouched && (
              <button onClick={() => { setFb({ rating: fbEntry.rating, useful: fbEntry.useful, confusing: fbEntry.confusing, improve: fbEntry.improve, wouldUseAgain: fbEntry.wouldUseAgain, notes: fbEntry.notes }); setFbTouched(true); }} className="mb-4 w-full rounded-md border border-pine-700 bg-pine-950/50 p-3.5 text-left transition-colors hover:border-tide-500/50">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-signal-300">{"★".repeat(fbEntry.rating)}<span className="text-pine-500">{"★".repeat(5 - fbEntry.rating)}</span></span>
                  <span className="font-mono text-[10px] uppercase text-fog-500">would use again: {fbEntry.wouldUseAgain}</span>
                </div>
                {fbEntry.useful && <p className="mt-1.5 text-[12px] text-fog-400"><strong className="text-fog-300">Useful:</strong> {fbEntry.useful}</p>}
                {fbEntry.confusing && <p className="mt-1 text-[12px] text-fog-400"><strong className="text-fog-300">Confusing:</strong> {fbEntry.confusing}</p>}
                {fbEntry.improve && <p className="mt-1 text-[12px] text-fog-400"><strong className="text-fog-300">Improve:</strong> {fbEntry.improve}</p>}
                {fbEntry.notes && <p className="mt-1 text-[12px] text-fog-400"><strong className="text-fog-300">Notes:</strong> {fbEntry.notes}</p>}
                <span className="mt-2 inline-block font-mono text-[10px] text-tide-400">click to edit</span>
              </button>
            )}
            {(fbTouched || !fbEntry) && (
              <div className="space-y-3.5">
                <div>
                  <span className="mb-1.5 block text-[12px] font-medium text-fog-300">Rating</span>
                  <div className="flex gap-1" role="radiogroup" aria-label="Rating from 1 to 5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} role="radio" aria-checked={fb.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setFb((f) => ({ ...f, rating: n }))}
                        className={cx("p-0.5 text-[20px] leading-none transition-transform hover:scale-110", n <= fb.rating ? "text-signal-400" : "text-pine-600 hover:text-fog-400")}>
                        <IStar size={20} className={n <= fb.rating ? "fill-signal-400" : ""} />
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="What was useful?"><Textarea value={fb.useful} onChange={(e) => setFb((f) => ({ ...f, useful: e.target.value }))} className="min-h-[54px]" placeholder="Which part solved something real?" /></Field>
                <Field label="What was confusing?"><Textarea value={fb.confusing} onChange={(e) => setFb((f) => ({ ...f, confusing: e.target.value }))} className="min-h-[54px]" placeholder="Where did they stall?" /></Field>
                <Field label="What should improve?"><Textarea value={fb.improve} onChange={(e) => setFb((f) => ({ ...f, improve: e.target.value }))} className="min-h-[54px]" placeholder="The one thing they'd change." /></Field>
                <Field label="Written feedback"><Textarea value={fb.notes} onChange={(e) => setFb((f) => ({ ...f, notes: e.target.value }))} className="min-h-[72px]" placeholder="Capture anything worth remembering." /></Field>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <Field label="Would use again?">
                      <Select value={fb.wouldUseAgain} onChange={(e) => setFb((f) => ({ ...f, wouldUseAgain: e.target.value as typeof f.wouldUseAgain }))}>
                        <option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option>
                      </Select>
                    </Field>
                  </div>
                  <Button
                    onClick={() => {
                      if (!fb.rating) { toast("err", "Pick a 1–5 rating first."); return; }
                      saveFeedback(prospect.id, fb);
                      setFbTouched(false);
                      toast("ok", "Feedback logged — funnel updated.");
                    }}
                  >
                    <IUsers size={13} /> Save feedback
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
