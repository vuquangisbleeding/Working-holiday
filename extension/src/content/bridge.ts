import { withStuck } from "./log";
import { shortUrl } from "./state";

let seq = 0;

export async function injectBridge(): Promise<void> {
  try {
    await callBridge("ping");
    return;
  } catch {
    // fallback inject
  }
  if (document.documentElement.dataset.whsBridge === "1") return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("page-bridge.js");
    s.onload = () => {
      document.documentElement.dataset.whsBridge = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Không nạp được page-bridge.js"));
    (document.head || document.documentElement).appendChild(s);
  });
}

export function callBridge(op: string, payload?: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    let done = false;
    const finish = (fn: (value: unknown) => void, value: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      document.removeEventListener("whs-bridge-result", onResult);
      fn(value);
    };
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.id !== id) return;
      const result = detail.result;
      if (result && result.error) finish(reject, new Error(result.error));
      else finish(resolve, result);
    };
    const timer = setTimeout(() => finish(reject, new Error("Bridge timeout: " + op)), 8000);
    document.addEventListener("whs-bridge-result", onResult);
    document.dispatchEvent(new CustomEvent("whs-bridge", { detail: { id, op, payload } }));
  }) as Promise<Record<string, unknown>>;
}

export function job(kind: string, value: unknown, suffixes: string | string[], optional = false) {
  return {
    kind,
    value: value == null ? "" : String(value),
    suffixes: Array.isArray(suffixes) ? suffixes : [suffixes],
    optional,
  };
}

export async function waitPostback(): Promise<void> {
  await withStuck("chờ postback | " + shortUrl(location.href), async () => {
    const detectUntil = Date.now() + 80;
    let started = false;
    while (Date.now() < detectUntil) {
      const r = await callBridge("inPostback");
      if (r && r.yes) {
        started = true;
        break;
      }
      await new Promise((res) => setTimeout(res, 20));
    }
    if (!started) return;
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      const still = await callBridge("inPostback");
      if (!still || !still.yes) break;
      await new Promise((res) => setTimeout(res, 50));
    }
  });
}
