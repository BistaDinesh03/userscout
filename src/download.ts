/* ── One-click source download ──────────────────────────────────────────
 * Bundles the entire project (source + config + docs) into a ZIP that is
 * generated right in the browser — no server, no dependencies. Files are
 * embedded at build time via import.meta.glob (raw), and the archive is
 * assembled here with a minimal ZIP writer (CRC32 + DEFLATE via the
 * platform CompressionStream, falling back to stored entries).
 */

const SRC_FILES = import.meta.glob("/src/**/*.{ts,tsx,css}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const ROOT_FILES = import.meta.glob(
  ["/index.html", "/package.json", "/tsconfig.json", "/vite.config.js", "/README.md", "/CONTRIBUTING.md", "/LICENSE"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const DOT_FILES = import.meta.glob(["/.env.example", "/.gitignore"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const SETUP_MD = `# UserScout — quick start

Everything you need is in this folder. No accounts, no server.

## 1. Install & run

\`\`\`
npm install
npm run dev
\`\`\`

Then open the URL Vite prints (usually http://localhost:5173).

Shell notes:
- Windows PowerShell 5.x does not support "&&" — run the two commands on
  separate lines, or join them with ";" (npm install; npm run dev).
- PowerShell 7, cmd.exe, macOS and Linux shells accept "npm install && npm run dev".

Other scripts: "npm run build" (production build), "npm run typecheck".
Node 18+ recommended.

## 2. Optional: raise GitHub API rate limits

Copy ".env.example" to ".env" and set VITE_GITHUB_TOKEN to any GitHub
personal access token (no special scopes needed — public read only).
Unauthenticated: 60 core requests/h and 10 search/min. With a token:
5,000/h and 30/min. Then restart the dev server.

## 3. Push to GitHub

\`\`\`
git init
git add .
git commit -m "UserScout — open-source user discovery for developers"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/userscout.git
git push -u origin main
\`\`\`

".env" is already gitignored, so tokens never leave your machine.

## What's inside

- src/core/      business logic (analysis, discovery, scoring, services)
- src/components + src/pages   the UI
- README.md      full architecture + scoring docs
- CONTRIBUTING.md, LICENSE (MIT)

Data stays local: accounts, prospects, notes and outreach history are
stored in your browser's localStorage — nothing is uploaded anywhere.
`;

/* ── ZIP writer ── */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const piped = new Blob([new Uint8Array(data)]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

const DOS_TIME = 0x0800; // 08:00
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01

async function buildZip(entries: { path: string; data: Uint8Array }[]): Promise<Uint8Array<ArrayBuffer>> {
  const canDeflate = typeof CompressionStream !== "undefined";
  const enc = new TextEncoder();
  const body: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.path);
    const crc = crc32(e.data);
    let compressed = e.data;
    let method = 0;
    if (canDeflate && e.data.length > 48) {
      const d = await deflate(e.data);
      if (d.length < e.data.length) {
        compressed = d;
        method = 8;
      }
    }

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 names
    lh.setUint16(8, method, true);
    lh.setUint16(10, DOS_TIME, true);
    lh.setUint16(12, DOS_DATE, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, compressed.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, name.length, true);
    body.push(new Uint8Array(lh.buffer), name, compressed);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, method, true);
    ch.setUint16(12, DOS_TIME, true);
    ch.setUint16(14, DOS_DATE, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, compressed.length, true);
    ch.setUint32(24, e.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true); // local header offset
    central.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + compressed.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);

  return concat([...body, ...central, new Uint8Array(eocd.buffer)]);
}

/* ── Public API ── */

export function sourceFileCount(): number {
  return Object.keys(SRC_FILES).length + Object.keys(ROOT_FILES).length + Object.keys(DOT_FILES).length + 1;
}

export async function downloadProjectZip(): Promise<number> {
  const enc = new TextEncoder();
  const entries: { path: string; data: Uint8Array }[] = [];
  const add = (path: string, content: string) => entries.push({ path: `userscout/${path}`, data: enc.encode(content) });

  for (const [path, content] of Object.entries({ ...ROOT_FILES, ...DOT_FILES })) {
    add(path.replace(/^\//, ""), content);
  }
  for (const [path, content] of Object.entries(SRC_FILES)) {
    add(path.replace(/^\//, ""), content);
  }
  add("SETUP.md", SETUP_MD);

  const zip = await buildZip(entries);
  const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "userscout-source.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return entries.length;
}
