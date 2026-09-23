export const RUN_KEY = "whsAutoRun";
export const LOG_KEY = "whsRunLog";
export const T0_KEY = "whsRunT0";
export const LAST_PAGE_KEY = "whsLastPage";
export const MAX_PAGES = 40;
export const CLICK_GUARD_KEY = "whsClickGuard";
export const HL_LAST_AT_KEY = "whsHlLastAt";
export const CAPTCHA_TOTAL_KEY = "whsCaptchaTotalMs";
export const CAPTCHA_COUNT_KEY = "whsCaptchaCount";
export const CAPTCHA_WAIT_KEY = "whsCaptchaWaitStart";

export let panel: HTMLElement | undefined;

export function setPanel(el: HTMLElement | undefined): void {
  panel = el;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.split("/").pop() + u.search.replace(/&?rqs=[^&]*/g, "");
  } catch {
    return url;
  }
}

export function hasSuffix(...suffixes: string[]): boolean {
  return suffixes.some((s) => document.querySelector('[id$="' + s + '"]'));
}

export function clickCooldownMs(op: string): number {
  if (op === "clickSubmit" || op === "clickLogin") return 4000;
  if (op === "clickApplyNow" || op === "clickEdit" || op === "clickPayNow") return 2500;
  return 1500;
}

export function lastClickAt(): number {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLICK_GUARD_KEY) || "null") as { t?: number } | null;
    return Number(g?.t || 0);
  } catch {
    return 0;
  }
}

export function wasAnyClickRecently(ms = 3000): boolean {
  const t = lastClickAt();
  return !!t && Date.now() - t < ms;
}

export function wasClickedRecently(op: string): boolean {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLICK_GUARD_KEY) || "null") as {
      op?: string;
      url?: string;
      t?: number;
    } | null;
    if (!g || g.op !== op || g.url !== location.href) return false;
    return Date.now() - Number(g.t || 0) < clickCooldownMs(op);
  } catch {
    return false;
  }
}

export function markClicked(op: string): void {
  sessionStorage.setItem(CLICK_GUARD_KEY, JSON.stringify({ op, url: location.href, t: Date.now() }));
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0.00s";
  if (ms < 60_000) return (ms / 1000).toFixed(2) + "s";
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms % 60_000) / 1000;
  return minutes + "m " + seconds.toFixed(2).padStart(5, "0") + "s";
}

export function beginCaptchaWait(): void {
  if (!sessionStorage.getItem(CAPTCHA_WAIT_KEY)) sessionStorage.setItem(CAPTCHA_WAIT_KEY, String(Date.now()));
}

export function endCaptchaWait(): number {
  const start = Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0");
  sessionStorage.removeItem(CAPTCHA_WAIT_KEY);
  if (!start) return 0;
  const ms = Math.max(0, Date.now() - start);
  if (ms >= 100) {
    sessionStorage.setItem(CAPTCHA_TOTAL_KEY, String(Number(sessionStorage.getItem(CAPTCHA_TOTAL_KEY) || "0") + ms));
    sessionStorage.setItem(CAPTCHA_COUNT_KEY, String(Number(sessionStorage.getItem(CAPTCHA_COUNT_KEY) || "0") + 1));
  }
  persistTiming();
  return ms;
}

export function captchaLiveMs(): number {
  const total = Number(sessionStorage.getItem(CAPTCHA_TOTAL_KEY) || "0");
  const start = Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0");
  const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
  const live = start && start >= t0 ? Math.max(0, Date.now() - start) : 0;
  return total + live;
}

export function captchaLiveCount(): number {
  const n = Number(sessionStorage.getItem(CAPTCHA_COUNT_KEY) || "0");
  const start = Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0");
  const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
  return n + (start && start >= t0 ? 1 : 0);
}

export function timingSummary(): string {
  const t0 = Number(sessionStorage.getItem(T0_KEY) || Date.now());
  const total = Math.max(0, Date.now() - t0);
  const captcha = Math.min(total, captchaLiveMs());
  const bot = Math.max(0, total - captcha);
  return formatTimingLine(total, bot, captcha, captchaLiveCount());
}

export function formatTimingLine(totalMs: number, botMs: number, captchaMs: number, count: number): string {
  return (
    "Tổng " +
    formatClock(totalMs) +
    " (bot " +
    formatClock(botMs) +
    " + captcha " +
    formatClock(captchaMs) +
    ", " +
    count +
    " lần)"
  );
}

export function persistTiming(): void {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
  if (!t0) return;
  const payload = {
    whsT0: t0,
    whsCaptchaTotal: Number(sessionStorage.getItem(CAPTCHA_TOTAL_KEY) || "0"),
    whsCaptchaCount: Number(sessionStorage.getItem(CAPTCHA_COUNT_KEY) || "0"),
    whsCaptchaWait: Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0"),
    whsRunActive: sessionStorage.getItem(RUN_KEY) === "1",
  };
  void chrome.storage.local.get(["whsT0"], (cur) => {
    if (Number(cur.whsT0 || 0) > t0) return;
    void chrome.storage.local.set(payload);
  });
}

export function timingFromPersisted(data: {
  whsT0?: number;
  whsCaptchaTotal?: number;
  whsCaptchaCount?: number;
  whsCaptchaWait?: number;
}): string {
  const t0 = Number(data.whsT0 || Date.now());
  const total = Math.max(0, Date.now() - t0);
  const waitStart = Number(data.whsCaptchaWait || 0);
  const live = waitStart && waitStart >= t0 ? Math.max(0, Date.now() - waitStart) : 0;
  const captcha = Math.min(total, Number(data.whsCaptchaTotal || 0) + live);
  const count = Number(data.whsCaptchaCount || 0) + (live ? 1 : 0);
  return formatTimingLine(total, Math.max(0, total - captcha), captcha, count);
}

export function resetTiming(): void {
  sessionStorage.setItem(T0_KEY, String(Date.now()));
  sessionStorage.setItem(CAPTCHA_TOTAL_KEY, "0");
  sessionStorage.setItem(CAPTCHA_COUNT_KEY, "0");
  sessionStorage.removeItem(CAPTCHA_WAIT_KEY);
  persistTiming();
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    void chrome.storage.local.set({
      whsPayLogged: false,
      whsRunActive: true,
      whsTelegramSent: false,
      whsLogSent: false,
      whsCaptchaTotal: 0,
      whsCaptchaCount: 0,
      whsCaptchaWait: 0,
      whsT0: Number(sessionStorage.getItem(T0_KEY) || Date.now()),
    });
  }
}

export function setStatus(text: string, cls = ""): void {
  const el = panel?.querySelector(".whs-status");
  if (!el) return;
  el.className = "whs-status" + (cls ? " " + cls : "");
  el.textContent = text;
}

let activity = { page: "", action: "" };

export function setActivity(page: string, action: string): void {
  activity = { page, action };
}

export function describeActivity(): string {
  const page = activity.page || shortUrl(location.href);
  const action = activity.action ? " | " + activity.action : "";
  return page + action;
}
