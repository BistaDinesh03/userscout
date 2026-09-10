/* Public contact discovery — triggers enrichment and shows channels with provenance. */

import { useEffect, useState } from "react";
import { useWorkspace } from "../state/store";
import { Badge, Button } from "./ui";
import { CopyButton } from "./bits";
import { IExt, IGlobe, IMail, IUsers, IAlert, ICheck } from "./icons";
import { cx } from "../core/utils";

interface Channel {
  id: string;
  type: string;
  value: string;
  url?: string | null;
  source_url?: string | null;
  source_type: string;
  confidence: string;
  is_public: boolean;
  is_verified: boolean;
  created_at?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  github: "GitHub",
  website: "Website",
  linkedin: "LinkedIn",
  x: "X",
  email: "Email",
  other: "Other",
};

const SOURCE_LABEL: Record<string, string> = {
  "github-profile": "Linked from GitHub",
  "github-blog": "GitHub profile website",
  "website-contact": "Found on public website",
  manual: "Added manually",
};

function iconFor(type: string, size = 13) {
  if (type === "email") return <IMail size={size} />;
  if (type === "linkedin" || type === "x" || type === "website") return <IGlobe size={size} />;
  if (type === "github") return <IUsers size={size} />;
  return <IExt size={size} />;
}

export function ContactChannelsPanel({ prospectId }: { prospectId: string }) {
  const { enrichProspectContacts, loadContactChannels, toast } = useWorkspace();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadContactChannels(prospectId) as Channel[];
        if (!cancelled) setChannels(list);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prospectId, loadContactChannels]);

  const runEnrich = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await enrichProspectContacts(prospectId) as { channels: Channel[]; errors: string[] };
      setChannels(r.channels);
      if (r.errors.length) {
        setError(r.errors[0]);
        toast("info", `Public contact discovery finished with notes: ${r.errors[0]}`);
      } else if (r.channels.length) {
        toast("ok", `${r.channels.length} public contact path${r.channels.length === 1 ? "" : "s"} found.`);
      } else {
        toast("info", "No public professional contact information found.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Enrichment failed.";
      setError(msg);
      toast("err", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-pine-700/80 bg-pine-900/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold">Contact</h2>
        <Button size="sm" variant="outline" onClick={runEnrich} loading={busy}>
          {channels.length ? "Refresh" : "Find public contact paths"}
        </Button>
      </div>

      {loading ? (
        <p className="text-[12.5px] text-fog-500">Loading…</p>
      ) : channels.length === 0 ? (
        <div>
          <p className="text-[12.5px] leading-relaxed text-fog-400">
            {busy ? "Finding public contact paths…" : "No public professional contact information found."}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog-500">
            UserScout only surfaces contact paths that are publicly listed on GitHub or on a site the person links from GitHub. It never guesses emails.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {channels.map((ch) => (
            <li key={ch.id} className="flex items-start justify-between gap-3 rounded-md border border-pine-700 bg-pine-950/50 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fog-400">
                    {iconFor(ch.type, 11)} {TYPE_LABEL[ch.type] ?? ch.type}
                  </span>
                  <Badge tone={ch.confidence === "high" ? "green" : ch.confidence === "medium" ? "amber" : "fog"} className="font-mono text-[9px]">
                    {ch.confidence} confidence
                  </Badge>
                  {ch.source_type && SOURCE_LABEL[ch.source_type] && (
                    <span className="text-[10.5px] text-fog-500">{SOURCE_LABEL[ch.source_type]}</span>
                  )}
                </div>
                <div className="mt-1 truncate text-[12.5px] text-fog-200">
                  {ch.type === "email" ? (
                    ch.value
                  ) : ch.url ? (
                    <a href={ch.url} target="_blank" rel="noopener noreferrer" className="text-tide-400 hover:underline">{ch.value}</a>
                  ) : (
                    ch.value
                  )}
                </div>
                {ch.source_url && (
                  <div className="mt-0.5 truncate font-mono text-[10px] text-fog-600">
                    Source: <a href={ch.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-fog-400">{ch.source_url}</a>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                {ch.url && ch.type !== "email" && (
                  <a href={ch.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded border border-pine-600 bg-pine-800/60 px-2 text-[11px] text-fog-300 hover:border-signal-500/60 hover:text-signal-300">
                    <IExt size={11} /> Open
                  </a>
                )}
                <CopyButton text={ch.value} label="Copy" size="sm" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-fog-500">
          <IAlert size={12} className="mt-px shrink-0 text-ember-400" /> {error}
        </p>
      )}
      {!loading && channels.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[10.5px] text-fog-500">
          <ICheck size={11} className="text-leaf-400" />
          Every channel is linked to its source above. UserScout never guesses contact information.
        </p>
      )}
    </section>
  );
}
