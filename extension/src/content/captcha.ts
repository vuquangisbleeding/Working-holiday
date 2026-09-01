import { callBridge } from "./bridge";
import { addLog, withStuck } from "./log";
import { hasSuffix, RUN_KEY, sleep, markClicked, beginCaptchaWait, endCaptchaWait } from "./state";

const TOKEN_MIN = 20;
const POLL_MS = 50;

export function isCaptchaUrl(): boolean {
  const url = location.href.toLowerCase();
  return url.includes("rs-captcha") || (url.includes("/captcha") && !url.includes("submit.aspx"));
}

export function recaptchaSolved(): boolean {
  const nodes = document.querySelectorAll(
    "#g-recaptcha-response, textarea[name='g-recaptcha-response'], textarea.g-recaptcha-response, textarea[id*='g-recaptcha-response']",
  );
  for (const node of nodes) {
    if (String((node as HTMLTextAreaElement).value || "").trim().length > TOKEN_MIN) return true;
  }
  return false;
}

export function isChallengeCaptcha(): boolean {
  if (isCaptchaUrl() && !recaptchaSolved()) return true;
  return Array.from(document.querySelectorAll("iframe")).some((f) => {
    const src = (f.src || "").toLowerCase();
    const title = (f.title || "").toLowerCase();
    const st = getComputedStyle(f);
    if (st.display === "none" || st.visibility === "hidden" || !f.offsetParent) return false;
    const challenge = src.includes("bframe") || src.includes("rs-captcha") || title.includes("challenge");
    return challenge && f.offsetWidth > 180 && f.offsetHeight > 180;
  });
}

function collectCaptchaInfo(): { pageURL: string; sitekey: string } {
  const pageURL = location.href;
  const keyed = document.querySelector("[data-sitekey]");
  let sitekey = keyed ? keyed.getAttribute("data-sitekey") || "" : "";
  if (!sitekey) {
    for (const f of document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"]')) {
      try {
        const u = new URL((f as HTMLIFrameElement).src);
        sitekey = u.searchParams.get("k") || u.searchParams.get("render") || sitekey;
      } catch {
        // ignore bad iframe src
      }
    }
  }
  return { pageURL, sitekey: sitekey || "(không thấy data-sitekey)" };
}

function dumpCaptchaInfo(): void {
  const info = collectCaptchaInfo();
  console.log("[WHS CAPTCHA] pageURL:", info.pageURL);
  console.log("[WHS CAPTCHA] data-sitekey:", info.sitekey);
  addLog("CAPTCHA_INFO", "pageURL=" + info.pageURL + " | data-sitekey=" + info.sitekey);
}

function recaptchaNeedsUser(): boolean {
  const widget = document.querySelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]');
  if (!widget) return false;
  return !recaptchaSolved();
}

function onSubmitFlow(): boolean {
  return location.href.toLowerCase().includes("submit.aspx") || hasSuffix("falseStatementCheckBox");
}

function captchaBlocking(includeSubmitWidget: boolean): boolean {
  if (recaptchaSolved()) return false;
  if (isCaptchaUrl()) return true;
  if (hasSuffix("falseStatementCheckBox") && !includeSubmitWidget) return false;
  if (isChallengeCaptcha()) return true;
  return !!(includeSubmitWidget && onSubmitFlow() && recaptchaNeedsUser());
}

export async function tickYesNow(): Promise<Record<string, unknown> | null> {
  if (!hasSuffix("falseStatementCheckBox")) return null;
  const unchecked = Array.from(document.querySelectorAll('input[type="checkbox"]')).some((el) => {
    const box = el as HTMLInputElement;
    return box.type === "checkbox" && !box.disabled && !box.checked && /CheckBox$/i.test(box.id || "");
  });
  if (!unchecked) return { skipped: true, checked: 1 };
  try {
    return await callBridge("tickDeclaration");
  } catch {
    return null;
  }
}

async function inPostback(): Promise<boolean> {
  try {
    const r = await callBridge("inPostback");
    return !!r?.yes;
  } catch {
    return false;
  }
}

async function pageLeft(beforeUrl: string): Promise<boolean> {
  if (location.href !== beforeUrl) return true;
  return inPostback();
}

async function clickAdvanceAfterCaptcha(preferSubmit: boolean, beforeUrl: string): Promise<Record<string, unknown> | null> {
  const settleUntil = Date.now() + 400;
  while (Date.now() < settleUntil) {
    if (sessionStorage.getItem(RUN_KEY) !== "1") return null;
    if (await pageLeft(beforeUrl)) return { ok: true, clicked: "NAV" };
    await sleep(POLL_MS);
  }
  if (await pageLeft(beforeUrl)) return { ok: true, clicked: "NAV" };
  try {
    const r = await callBridge("clickAfterCaptcha", { preferSubmit });
    if (r?.ok) {
      markClicked(preferSubmit ? "clickSubmit" : "clickNext");
      return r;
    }
  } catch {
    // button may still be disabled for a tick after the token appears
  }
  return null;
}

function waitUntilSolvedOrUnblocked(includeSubmitWidget: boolean): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stop();
      resolve();
    };
    const onTick = () => {
      if (sessionStorage.getItem(RUN_KEY) !== "1" || recaptchaSolved() || !captchaBlocking(includeSubmitWidget)) {
        finish();
      }
    };
    const timer = window.setInterval(onTick, POLL_MS);
    const observer = new MutationObserver(onTick);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    const onEvent = () => onTick();
    document.addEventListener("input", onEvent, true);
    document.addEventListener("change", onEvent, true);
    const stop = () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("input", onEvent, true);
      document.removeEventListener("change", onEvent, true);
    };
    onTick();
  });
}

export async function waitCaptcha(includeSubmitWidget = false, clickWhenSolved = true): Promise<boolean> {
  if (!captchaBlocking(includeSubmitWidget)) return false;
  dumpCaptchaInfo();
  beginCaptchaWait();
  const beforeUrl = location.href;
  addLog("CAPTCHA", includeSubmitWidget ? "Chờ reCAPTCHA trước SUBMIT" : "Chờ captcha (đã tick Yes nếu có)");
  try {
    await withStuck(includeSubmitWidget ? "chờ reCAPTCHA SUBMIT" : "chờ captcha", () =>
      waitUntilSolvedOrUnblocked(includeSubmitWidget),
    );
    const waited = endCaptchaWait();
    if (waited >= 100) addLog("CAPTCHA", "Xong captcha", waited);
    if (sessionStorage.getItem(RUN_KEY) !== "1") return false;
    if (!clickWhenSolved) return false;
    const advanced = await clickAdvanceAfterCaptcha(includeSubmitWidget, beforeUrl);
    if (advanced?.ok && advanced.clicked !== "NAV") {
      const label = String(advanced.clicked || "NEXT");
      const id = advanced.id ? " #" + String(advanced.id).split("_").pop() : "";
      addLog("CLICK", "Captcha xong — bấm " + label + id + " ngay");
    }
    return !!advanced?.ok;
  } finally {
    endCaptchaWait();
  }
}

export async function waitNav(beforeUrl: string, timeout = 20000): Promise<boolean> {
  const { isAccessDenied, isHighLoad, findPaymentUrl, isHostedPayUrl } = await import("./detect");
  let unloading = false;
  const onGone = () => {
    unloading = true;
  };
  window.addEventListener("pagehide", onGone);
  window.addEventListener("beforeunload", onGone);
  try {
    return await withStuck("chờ chuyển trang " + beforeUrl, async () => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (sessionStorage.getItem(RUN_KEY) !== "1") return false;
        const pay = findPaymentUrl();
        if (
          location.href !== beforeUrl ||
          unloading ||
          isChallengeCaptcha() ||
          isHighLoad() ||
          isAccessDenied() ||
          (pay !== beforeUrl && isHostedPayUrl(pay)) ||
          !!document.querySelector("iframe[src*='paystation']")
        ) {
          return true;
        }
        await sleep(80);
      }
      return location.href !== beforeUrl || unloading;
    });
  } finally {
    window.removeEventListener("pagehide", onGone);
    window.removeEventListener("beforeunload", onGone);
  }
}

window.addEventListener("pagehide", () => {
  endCaptchaWait();
});
