import { spawn, type ChildProcess } from "child_process";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DEFAULT_WHS, type Applicant } from "../types.ts";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const APPLICANT = path.join(ROOT, "applicant.json");
const LOGS = path.join(ROOT, "logs");
const LATEST_LOG = path.join(LOGS, "latest.log");
const STATUS_FILE = path.join(LOGS, "status.json");

type JsonObject = Record<string, unknown>;

function deepMerge(base: JsonObject, incoming: JsonObject): JsonObject {
  const out: JsonObject = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const current = out[key];
    if (isObject(value) && isObject(current)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadApplicant(): Applicant {
  const data = fs.existsSync(APPLICANT)
    ? (JSON.parse(fs.readFileSync(APPLICANT, "utf8")) as Applicant)
    : ({} as Applicant);
  if (!data.whs || typeof data.whs !== "object") {
    data.whs = { ...DEFAULT_WHS };
  } else {
    for (const [key, value] of Object.entries(DEFAULT_WHS)) {
      if (data.whs[key as keyof typeof data.whs] === undefined) {
        (data.whs as Record<string, string>)[key] = value;
      }
    }
  }
  return data;
}

let botProc: ChildProcess | null = null;

function botRunning(): boolean {
  if (!botProc) return false;
  if (botProc.exitCode === null && botProc.signalCode === null) return true;
  botProc = null;
  return false;
}

function readStatus(): Record<string, unknown> {
  const running = botRunning();
  const status: Record<string, unknown> = {
    state: running ? "running" : "idle",
    running,
    step: "",
    message: "",
    log_file: fs.existsSync(LATEST_LOG) ? LATEST_LOG : "",
  };
  if (fs.existsSync(STATUS_FILE)) {
    try {
      Object.assign(status, JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")));
    } catch {
      // ignore broken status.json
    }
  }
  if (running && (status.state === "done" || status.state === "idle")) {
    status.state = "running";
  }
  if (!running && (status.state === "running" || status.state === "captcha_paused")) {
    status.state = "idle";
  }
  status.running = running;
  return status;
}

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/static", express.static(path.join(ROOT, "static"), { etag: false }));

app.get("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(ROOT, "static", "index.html"));
});

app.get("/api/data", (_req, res) => {
  res.json(loadApplicant());
});

app.post("/api/data", (req, res) => {
  if (!isObject(req.body)) {
    res.status(400).json({ ok: false, error: "JSON object required" });
    return;
  }
  const merged = deepMerge(loadApplicant() as unknown as JsonObject, req.body);
  if (!isObject(merged.whs)) merged.whs = { ...DEFAULT_WHS };
  fs.writeFileSync(APPLICANT, JSON.stringify(merged, null, 2) + "\n", "utf8");
  res.json({ ok: true, data: merged });
});

app.get("/api/logs", (_req, res) => {
  const text = fs.existsSync(LATEST_LOG) ? fs.readFileSync(LATEST_LOG, "utf8") : "";
  res.json({ text, status: readStatus() });
});

app.get("/api/status", (_req, res) => {
  res.json(readStatus());
});

app.post("/api/run", (_req, res) => {
  if (botRunning()) {
    res.status(409).json({ ok: false, error: "Bot đang chạy" });
    return;
  }
  fs.mkdirSync(LOGS, { recursive: true });
  const tsx = path.join(ROOT, "node_modules", ".bin", "tsx");
  const bot = path.join(ROOT, "src", "bot", "login.ts");
  botProc = spawn(tsx, [bot], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: "inherit",
  });
  res.json({ ok: true, pid: botProc.pid });
});

app.post("/api/stop", (_req, res) => {
  if (!botRunning() || !botProc) {
    res.json({ ok: true, stopped: false });
    return;
  }
  const child = botProc;
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 8000);
  child.once("exit", () => clearTimeout(timer));
  botProc = null;
  res.json({ ok: true, stopped: true });
});

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  fs.mkdirSync(path.join(ROOT, "static"), { recursive: true });
  fs.mkdirSync(LOGS, { recursive: true });
  app.listen(5050, "127.0.0.1", () => {
    console.log("Dashboard: http://127.0.0.1:5050");
  });
}
