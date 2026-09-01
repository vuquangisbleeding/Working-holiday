export const RUN_KEY = "whsAutoRun";
export const LOG_KEY = "whsRunLog";
export const T0_KEY = "whsRunT0";
export const LAST_PAGE_KEY = "whsLastPage";
export const MAX_PAGES = 40;

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
