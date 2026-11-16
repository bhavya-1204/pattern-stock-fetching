import { useCallback, useEffect, useMemo, useState } from "react";

const BASE =
  "https://raw.githubusercontent.com/bhavya-1204/pattern-stock-fetching/master/output/";
const UPDATED_URL =
  "https://raw.githubusercontent.com/bhavya-1204/pattern-stock-fetching/master/last_updated.txt";

const SCANNERS = [
  { id: "vcp", nav: "VCP", title: "VCP", file: "vcp_output.csv",
    desc: "Volatility contraction setups using EMA and contraction rules." },
  { id: "rocket-base", nav: "RB", title: "Rocket Base", file: "latest_output.csv",
    desc: "Chart patterns confirmed by EMA and price action." },
  { id: "futures-options", nav: "F&O", title: "Futures & Options", file: "future_output.csv",
    desc: "Momentum stocks in F&O, filtered by EMA and volume." },
];

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

const wrap = "mx-auto w-full max-w-[1180px] px-5 sm:px-8";

/* ---------- Top bar ---------- */
function TopBar({ active }) {
  const link = (on) =>
    `border-b-2 py-4 text-sm font-semibold transition-colors ${
      on ? "border-signal text-ink" : "border-transparent text-muted hover:text-ink"
    }`;
  return (
    <div className="sticky top-0 z-20 border-b border-hair bg-bg/80 backdrop-blur">
      <div className={`${wrap} flex items-center justify-between gap-6`}>
        <a href="#/" className="py-3 font-serif text-2xl leading-none tracking-tight">
          Stock Selection
        </a>
        <nav className="-mb-px flex items-center gap-5 overflow-x-auto sm:gap-7" aria-label="Scanners">
          <a href="#/" className={link(!active)}>Overview</a>
          {SCANNERS.map((s) => (
            <a key={s.id} href={`#/${s.id}`} className={link(active === s.id)} aria-current={active === s.id ? "page" : undefined}>
              {s.nav}
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
  const ready = counts.every((c) => c !== undefined);
  const total = ready ? counts.reduce((a, b) => a + b, 0) : 0;

  return (
    <main className={`${wrap} pb-20 pt-14 sm:pt-24`}>
      <header className="rise mb-14 sm:mb-20">
        <h1 className="font-serif text-6xl leading-[0.95] tracking-tight sm:text-8xl">
          Stock selection<br />dashboard
        </h1>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="flex items-center gap-2.5 font-mono text-sm">
            <span className="size-2 rounded-full bg-pos" aria-hidden="true" />
            {updated ? `Last updated: ${updated}` : "Checking last update…"}
          </p>
          {ready && <span className="text-sm text-muted">{total} patterns across {SCANNERS.length} scanners</span>}
        </div>
      </header>

      <ul className="border-t border-hair">
        {SCANNERS.map((s, i) => {
          const n = cache.get(s.file)?.data.length;
          const share = ready && total ? n / total : 0;
          return (
            <li key={s.id} className="rise" style={{ animationDelay: `${150 + i * 90}ms` }}>
              <a
                href={`#/${s.id}`}
                title={ready ? `${Math.round(share * 100)}% of all patterns` : undefined}
                className="group relative grid grid-cols-[1fr_auto_auto] items-end gap-x-6 border-b border-hair py-8 transition-colors hover:bg-white/[0.025] sm:gap-x-10 sm:py-10"
              >
                <div>
                  <h2 className="font-serif text-4xl leading-none tracking-tight sm:text-6xl">{s.title}</h2>
                  <p className="mt-3 max-w-[48ch] text-muted">{s.desc}</p>
                </div>
                <div className="text-right">
                  <strong className="block font-mono text-4xl font-medium leading-none tabular-nums sm:text-6xl">
                    {n ?? <span className="text-muted">–</span>}
                  </strong>
                  <span className="mt-2 block text-sm text-muted">patterns found</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  className="mb-1 size-6 text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-signal" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Amber hairline = this scanner's share of all patterns today */}
                <span
                  className="absolute -bottom-px left-0 h-px w-full origin-left bg-signal opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ transform: `scaleX(${share})`, transition: "transform .8s cubic-bezier(.2,.7,.2,1), opacity .3s" }}
                />
              </a>
            </li>
          );
        })}
      </ul>

      <footer className="mt-16 text-sm text-muted">Made by Bhavya Patel</footer>
    </main>
  );
}

/* ---------- Scanner page ---------- */
function Stat({ label, value }) {
  return (
    <div className="px-4 py-4 first:pl-0">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums sm:text-lg">{value}</div>
    </div>
  );
}

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

  return (
    <main className={`${wrap} pb-20 pt-10 sm:pt-16`}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-7xl">{scanner.title}</h1>
          <p className="mt-3 text-muted">{scanner.desc}</p>
        </div>
        {/* <button
          onClick={refresh}
          className="cursor-pointer rounded-[2px] bg-signal px-4 py-2.5 text-sm font-bold text-bg transition-[filter] hover:brightness-110"
        >
          Refresh now
        </button> */}
      </header>

      {data && (
        <div className="mb-8 grid grid-cols-3 divide-x divide-hair border-y border-hair">
          <Stat label="Patterns found" value={data.data.length} />
          {/* <Stat label="Last scan" value={lastScan ? fmtTime(lastScan) : "–"} />
          <Stat label="Checked" value={ago(data.at)} /> */}
        </div>
      )}

      {loading && (
        <div className="grid gap-px" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse bg-surface motion-reduce:animate-none" />
          ))}
        </div>
      )}

      {error && !data && (
        <div className="rounded-[4px] border border-neg/40 bg-surface p-5">
          <strong>No data yet.</strong> {error}. The scan may still be running, so try again in a minute.
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="border border-hair bg-surface p-10 text-center">
          <strong className="block font-serif text-3xl font-normal">No patterns in the latest scan</strong>
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
              className="w-full max-w-[320px] rounded-[2px] border border-hair bg-surface px-3.5 py-2.5 text-sm transition-colors placeholder:text-muted hover:border-white/20 focus:border-signal focus:outline-none"
            />
            <span className="font-mono text-xs text-muted">
              {rows.length === data.data.length ? `${rows.length} rows` : `${rows.length} of ${data.data.length} rows`}
            </span>
            <button
              onClick={() => downloadCSV(data.cols, rows, `${scanner.id}.csv`)}
              className="ml-auto cursor-pointer rounded-[2px] border border-hair px-3.5 py-2.5 text-sm font-semibold transition-colors hover:border-signal hover:text-signal"
            >
              Download CSV
            </button>
          </div>

          <div className="thin-scroll max-h-[66vh] overflow-auto rounded-[4px] border border-hair bg-surface">
            <table className="w-full border-collapse font-mono text-[13px]">
              <thead>
                <tr>
                  {data.cols.map((c) => (
                    <th
                      key={c}
                      aria-sort={sort.col === c ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                      className="sticky top-0 z-10 border-b border-hair bg-surface text-left font-sans"
                    >
                      <button
                        onClick={() => toggle(c)}
                        className={`flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-3 text-xs font-semibold capitalize transition-colors hover:text-ink ${
                          sort.col === c ? "text-ink" : "text-muted"
                        }`}
                      >
                        {c.replace(/_/g, " ")}
                        <i className="text-[9px] not-italic text-signal">{sort.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}</i>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="group transition-colors hover:bg-signal/[0.06]">
                    {data.cols.map((c, j) => {
                      const v = r[c];
                      const num = isNum(v);
                      return (
                        <td
                          key={c}
                          className={[
                            "whitespace-nowrap border-b border-hair px-4 py-2.5",
                            j === 0 ? "font-bold text-signal group-hover:shadow-[inset_2px_0_0_var(--color-signal)]" : "",
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
