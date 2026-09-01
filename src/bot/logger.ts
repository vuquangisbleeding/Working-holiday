import fs from "fs";
import path from "path";
import { localClock, localIsoSeconds, localStamp, nowSec } from "./time.ts";

interface LogStep {
  time: string;
  level: string;
  step: string;
  message: string;
  duration: number | null;
}

export class RunStats {
  login_started_at = nowSec();
  captcha_total = 0;
  captcha_count = 0;

  add_captcha(seconds: number): void {
    this.captcha_total += seconds;
    this.captcha_count += 1;
  }

  elapsed(): number {
    return nowSec() - this.login_started_at;
  }
}

export class RunLogger {
  dir: string;
  path: string;
  latest: string;
  steps: LogStep[] = [];

  constructor(root: string) {
    this.dir = path.join(root, "logs");
    fs.mkdirSync(this.dir, { recursive: true });
    this.path = path.join(this.dir, `run-${localStamp()}.log`);
    this.latest = path.join(this.dir, "latest.log");
    fs.writeFileSync(this.path, "", "utf-8");
  }

  private write(level: string, step: string, message = "", duration: number | null = null): void {
    const ts = localClock();
    const dur = duration !== null ? ` (${duration.toFixed(2)}s)` : "";
    const detail = message ? ` — ${message}` : "";
    const line = `[${ts}] [${level}] ${step}${dur}${detail}`;
    console.log(line);
    fs.appendFileSync(this.path, `${line}\n`, "utf-8");
    fs.copyFileSync(this.path, this.latest);
    this.steps.push({ time: ts, level, step, message, duration });
    this.writeStatus(level, step, message);
  }

  private writeStatus(level: string, step: string, message: string): void {
    let state = "running";
    if (level === "PAUSE") state = "captcha_paused";
    else if (step === "DONE") state = "done";
    else if (level === "ERROR" || step.startsWith("FAIL")) state = "error";
    fs.writeFileSync(
      path.join(this.dir, "status.json"),
      JSON.stringify(
        { state, level, step, message, updated_at: localIsoSeconds(), log_file: this.path },
        null,
        2,
      ),
      "utf-8",
    );
  }

  info(step: string, message = "", duration: number | null = null): void {
    this.write("INFO", step, message, duration);
  }

  pause(step: string, message = ""): void {
    this.write("PAUSE", step, message);
  }

  ok(step: string, message = "", duration: number | null = null): void {
    this.write("OK", step, message, duration);
  }

  error(step: string, message = ""): void {
    this.write("ERROR", step, message);
  }
}

export function watchStuck(label: string): () => void {
  const started = nowSec();
  const fired = new Set<number>();
  const id = setInterval(() => {
    const s = nowSec() - started;
    if (s < 1) return;
    const bucket = s < 2 ? 1 : s < 4 ? 2 : Math.floor(s / 2) * 2;
    if (fired.has(bucket)) return;
    fired.add(bucket);
    try {
      log().info("STUCK", `${label} ${s.toFixed(1)}s`);
    } catch {
      // logger not ready
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

let LOG: RunLogger | null = null;
let STATS: RunStats | null = null;

export function initRun(root: string): { log: RunLogger; stats: RunStats } {
  LOG = new RunLogger(root);
  STATS = new RunStats();
  return { log: LOG, stats: STATS };
}

export function stats(): RunStats {
  if (!STATS) throw new Error("Stats not initialized");
  return STATS;
}

export function log(): RunLogger {
  if (!LOG) throw new Error("Logger not initialized");
  return LOG;
}
