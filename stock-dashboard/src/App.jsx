import { useCallback, useEffect, useMemo, useState } from "react";

const BASE =
  "https://raw.githubusercontent.com/bhavya-1204/pattern-stock-fetching/master/output/";
// Served from /public/last_updated.txt. To read it from GitHub instead, use:
// BASE.replace("output/", "last_updated.txt")  (if the file is in the repo root)
const UPDATED_URL = "https://raw.githubusercontent.com/bhavya-1204/pattern-stock-fetching/master/last_updated.txt";

const Icon = {
  rocket: (
    <path d="M5 21V10m5 11V4m5 17v-8m5 8V7" strokeLinecap="round" />
  ),
  bolt: <path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" strokeLinejoin="round" />,
  funnel: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" strokeLinejoin="round" />,
};

const SCANNERS = [
  { id: "vcp", title: "VCP", icon: "funnel", color: "#a78bfa", file: "vcp_output.csv",
    desc: "Volatility contraction setups using EMA and contraction rules." },
  { id: "rocket-base", title: "Rocket Base", icon: "rocket", color: "#f2a93b", file: "latest_output.csv",
    desc: "Chart patterns confirmed by EMA and price action." },
  { id: "futures-options", title: "Futures & Options", icon: "bolt", color: "#2dd4bf", file: "future_output.csv",
    desc: "Momentum stocks in F&O, filtered by EMA and volume." },
];

function Svg({ name, className = "size-6" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      {Icon[name]}
    </svg>
  );
}

/* ---------- CSV parsing (no dependency) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x !== ""));
  if (!clean.length) return { cols: [], data: [] };
  const [head, ...body] = clean;
  return { cols: head, data: body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]))) };
}

/* ---------- Data layer: shared cache + polling ---------- */
const cache = new Map();

async function load(file) {
  const res = await fetch(BASE + file, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  const parsed = { ...parseCSV(await res.text()), at: Date.now() };
  cache.set(file, parsed);
  return parsed;
}

function useScanner(file, interval = 120_000) {
  const [state, setState] = useState({ data: cache.get(file) || null, error: null, loading: !cache.get(file) });
  const refresh = useCallback(async () => {
    try {
      setState({ data: await load(file), error: null, loading: false });
    } catch (e) {
      setState((s) => ({ ...s, error: e.message, loading: false }));
    }
  }, [file]);
  useEffect(() => {
    setState({ data: cache.get(file) || null, error: null, loading: !cache.get(file) });
    refresh();
    const t = setInterval(() => !document.hidden && refresh(), interval);
    return () => clearInterval(t);
  }, [file, interval, refresh]);
  return { ...state, refresh };
}

/* Reads the "last updated" text file; re-checks every 2 minutes */
function useUpdated() {
  const [text, setText] = useState("");
  useEffect(() => {
    const get = () =>
      fetch(`${UPDATED_URL}?t=${Date.now()}`)
        .then((r) => (r.ok ? r.text() : ""))
        .then((t) => setText(t.trim()))
        .catch(() => {});
    get();
    const t = setInterval(() => !document.hidden && get(), 120_000);
    return () => clearInterval(t);
  }, []);
  return text;
}

function useHash() {
  const read = () => window.location.hash.replace(/^#\/?/, "");
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const fn = () => setHash(read());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  return hash;
}

/* ---------- Helpers ---------- */
const isNum = (v) => v !== "" && !isNaN(Number(v));
const fmtTime = (v) => {
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
};
const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
};
function useTick(ms = 15000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
function downloadCSV(cols, rows, name) {
  const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const wrap = "mx-auto w-full max-w-[1180px] px-4 sm:px-6";

/* ---------- Top bar ---------- */
function TopBar({ active }) {
  const link = (on) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
      on ? "bg-ink/10 text-ink" : "text-muted hover:text-ink"
    }`;
  return (
    <div className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className={`${wrap} flex h-14 items-center justify-between gap-4`}>
        <a href="#/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-bg">
            <Svg name="rocket" className="size-5" />
          </span>
          <span className="hidden sm:inline">Stock Selection</span>
        </a>
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Scanners">
          <a href="#/" className={link(!active)}>Overview</a>
          {SCANNERS.map((s) => (
            <a key={s.id} href={`#/${s.id}`} className={link(active === s.id)} aria-current={active === s.id ? "page" : undefined}>
              {s.id === "futures-options" ? "F&O" : s.id === "rocket-base" ? "RB" : s.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ---------- Home ---------- */
function Home({ updated }) {
  // Prefetch all CSVs so every scanner opens instantly
  useEffect(() => {
    SCANNERS.forEach((s) => !cache.has(s.file) && load(s.file).catch(() => {}));
  }, []);
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 800);
    const stop = setTimeout(() => clearInterval(t), 8000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, []);

  const counts = SCANNERS.map((s) => cache.get(s.file)?.data.length);
  const total = counts.every((c) => c !== undefined) ? counts.reduce((a, b) => a + b, 0) : null;

  return (
    <main className={`${wrap} pb-16 pt-10 sm:pt-16`}>
      <header className="mb-10 sm:mb-14">
        <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
          Stock selection<br className="hidden sm:block" /> dashboard
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            {updated ? `Last updated: ${updated}` : "Checking last update…"}
          </p>
          {total !== null && (
            <span className="text-sm text-muted">{total} patterns across {SCANNERS.length} scanners</span>
          )}
        </div>
      </header>

      <ul className="grid gap-5 md:grid-cols-3">
        {SCANNERS.map((s) => {
          const d = cache.get(s.file);
          return (
            <li key={s.id}>
              <a
                href={`#/${s.id}`}
                style={{ "--c": s.color }}
                className="group flex h-full flex-col rounded-2xl border border-line border-t-4 border-t-(--c) bg-panel p-6 transition-colors hover:border-(--c)"
              >
                <span className="mb-5 grid size-11 place-items-center rounded-xl bg-(--c)/15 text-(--c)">
                  <Svg name={s.icon} />
                </span>
                <h2 className="text-xl font-bold">{s.title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{s.desc}</p>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <strong className="block text-5xl font-extrabold leading-none tabular-nums">
                      {d ? d.data.length : <span className="text-muted">–</span>}
                    </strong>
                    <span className="text-sm text-muted">patterns found</span>
                  </div>
                  <span className="text-sm font-bold text-(--c) group-hover:underline">Open scan</span>
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <footer className="mt-16 border-t border-line pt-6 text-sm text-muted">Made by Bhavya Patel</footer>
    </main>
  );
}

/* ---------- Scanner page ---------- */
function Scanner({ scanner }) {
  const { data, error, loading, refresh } = useScanner(scanner.file);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ col: null, dir: 1 });
  useTick();

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let out = q ? data.data.filter((r) => Object.values(r).some((v) => v.toLowerCase().includes(q))) : data.data;
    if (sort.col) {
      out = [...out].sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        return (isNum(x) && isNum(y) ? x - y : x.localeCompare(y)) * sort.dir;
      });
    }
    return out;
  }, [data, query, sort]);

  const lastScan = data?.data[0]?.scan_time;
  const toggle = (col) => setSort((s) => (s.col === col ? { col, dir: -s.dir } : { col, dir: 1 }));

  const Stat = ({ label, value }) => (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</div>
    </div>
  );

  return (
    <main className={`${wrap} pb-16 pt-8 sm:pt-12`} style={{ "--c": scanner.color }}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-(--c)/15 text-(--c)">
            <Svg name={scanner.icon} />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{scanner.title}</h1>
            <p className="text-muted">{scanner.desc}</p>
          </div>
        </div>
        {/* <button
          onClick={refresh}
          className="cursor-pointer rounded-lg bg-(--c) px-4 py-2.5 font-bold text-[#0f1b2d] hover:brightness-110"
        >
          Refresh now
        </button> */}
      </header>

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Patterns found" value={data.data.length} />
          {/* <Stat label="Last scan" value={lastScan ? fmtTime(lastScan) : "–"} />
          <Stat label="Checked" value={ago(data.at)} /> */}
        </div>
      )}

      {loading && (
        <div className="grid gap-2" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-panel motion-reduce:animate-none" />
          ))}
        </div>
      )}

      {error && !data && (
        <div className="rounded-xl border border-neg bg-panel p-5">
          <strong>No data yet.</strong> {error}. The scan may still be running, so try again in a minute.
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="rounded-xl border border-line bg-panel p-8 text-center">
          <strong className="block text-lg">No patterns in the latest scan</strong>
          <span className="text-muted">This page checks again every 2 minutes.</span>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search symbol or any value"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search results"
              className="w-full max-w-[340px] rounded-lg border border-line bg-panel px-3.5 py-2.5 placeholder:text-muted"
            />
            <span className="text-sm text-muted">
              {rows.length === data.data.length ? `${rows.length} rows` : `${rows.length} of ${data.data.length} rows`}
            </span>
            <button
              onClick={() => downloadCSV(data.cols, rows, `${scanner.id}.csv`)}
              className="ml-auto cursor-pointer rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm font-semibold hover:border-(--c)"
            >
              Download CSV
            </button>
          </div>

          <div className="max-h-[68vh] overflow-auto rounded-xl border border-line bg-panel">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {data.cols.map((c) => (
                    <th
                      key={c}
                      aria-sort={sort.col === c ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                      className="sticky top-0 z-10 border-b border-line bg-panel text-left"
                    >
                      <button
                        onClick={() => toggle(c)}
                        className="flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-3.5 py-3 font-bold capitalize text-muted hover:text-ink"
                      >
                        {c.replace(/_/g, " ")}
                        <i className="text-[10px] not-italic text-(--c)">
                          {sort.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}
                        </i>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="even:bg-ink/[0.03] hover:bg-(--c)/10">
                    {data.cols.map((c, j) => {
                      const v = r[c];
                      const num = isNum(v);
                      return (
                        <td
                          key={c}
                          className={[
                            "whitespace-nowrap border-b border-line px-3.5 py-2.5",
                            j === 0 ? "font-bold text-(--c)" : "",
                            num ? "text-right tabular-nums" : "",
                            num && Number(v) < 0 ? "text-neg" : "",
                          ].join(" ")}
                        >
                          {c === "scan_time" ? fmtTime(v) : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

/* ---------- App ---------- */
export default function App() {
  const hash = useHash();
  const updated = useUpdated();
  const scanner = SCANNERS.find((s) => s.id === hash);
  useEffect(() => {
    document.title = scanner ? `${scanner.title} scanner` : "Stock selection dashboard";
    window.scrollTo(0, 0);
  }, [scanner]);
  return (
    <>
      <TopBar active={scanner?.id} />
      {scanner ? <Scanner scanner={scanner} /> : <Home updated={updated} />}
    </>
  );
}
