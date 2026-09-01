import { LAST_PAGE_KEY, LOG_KEY, panel, setStatus, T0_KEY, describeActivity, timingSummary, resetTiming, persistTiming } from "./state";

interface LogEntry {
  t: string;
  elapsed: string;
  kind: string;
  text: string;
  dur: string;
}

function padMs(d: Date): string {
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0") +
    "." +
    String(d.getMilliseconds()).padStart(3, "0")
  );
}

function formatDur(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "";
  if (ms < 1000) return Math.round(ms) + "ms";
  return (ms / 1000).toFixed(2) + "s";
}

function loadLog(): LogEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]") as LogEntry[];
  } catch {
    return [];
  }
}

function logLine(entry: LogEntry): string {
  const dur = entry.dur ? "  " + entry.dur : "";
  return "[" + entry.t + "  +" + entry.elapsed + "s] " + entry.kind + " — " + entry.text + dur;
}

export function renderLog(): void {
  const box = panel?.querySelector(".whs-log");
  if (!box) return;
  box.textContent = loadLog().map(logLine).join("\n") || "Chưa có log. Bấm Chạy.";
  box.scrollTop = box.scrollHeight;
  renderClock();
}

export function renderClock(): void {
  const el = panel?.querySelector(".whs-clock");
  if (!el) return;
  if (!sessionStorage.getItem(T0_KEY)) {
    el.textContent = "";
    return;
  }
  el.textContent = timingSummary();
  persistTiming();
}

let clockTimer: number | undefined;

export function startClock(): void {
  renderClock();
  if (clockTimer) return;
  clockTimer = window.setInterval(renderClock, 250);
}

export function stopClock(): void {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = undefined;
  }
  renderClock();
}

export function addLog(kind: string, text: string, durMs?: number): void {
  const t0 = Number(sessionStorage.getItem(T0_KEY) || Date.now());
  if (!sessionStorage.getItem(T0_KEY)) sessionStorage.setItem(T0_KEY, String(t0));
  const entry: LogEntry = {
    t: padMs(new Date()),
    elapsed: ((Date.now() - t0) / 1000).toFixed(2),
    kind,
    text: String(text || ""),
    dur: formatDur(durMs),
  };
  const rows = loadLog();
  rows.push(entry);
  sessionStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-250)));
  renderLog();
  const cls = kind === "ERR" ? "err" : kind === "CAPTCHA" || kind === "HIGH_LOAD" || kind === "TRY_AGAIN" || kind === "STUCK" ? "pause" : "";
  setStatus(kind + ": " + entry.text + (entry.dur ? " (" + entry.dur + ")" : ""), cls);
}

export function resetLog(): void {
  resetTiming();
  sessionStorage.setItem(LOG_KEY, "[]");
  sessionStorage.removeItem(LAST_PAGE_KEY);
  renderLog();
}

export function copyLog(): void {
  const lines = loadLog().map(logLine);
  if (sessionStorage.getItem(T0_KEY)) lines.push(timingSummary());
  const text = lines.join("\n");
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => setStatus("Đã copy log.", "ok"),
    () => setStatus("Copy thất bại.", "err"),
  );
}

export function watchStuck(label: string): () => void {
  const started = Date.now();
  const fired = new Set<number>();
  const id = setInterval(() => {
    const s = (Date.now() - started) / 1000;
    if (s >= 1 && !fired.has(1)) {
      fired.add(1);
      addLog("STUCK", label + " >1s trên " + describeActivity() + " (" + s.toFixed(1) + "s)");
    } else if (s >= 2 && !fired.has(2)) {
      fired.add(2);
      addLog("STUCK", label + " >2s trên " + describeActivity() + " (" + s.toFixed(1) + "s)");
    } else if (s >= 4) {
      const bucket = Math.floor(s / 2) * 2;
      if (!fired.has(bucket)) {
        fired.add(bucket);
        addLog("STUCK", label + " vẫn chờ " + s.toFixed(1) + "s trên " + describeActivity());
      }
    }
  }, 200);
  return () => clearInterval(id);
}

export async function withStuck<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const stop = watchStuck(label);
  try {
    return await fn();
  } finally {
    stop();
  }
}
