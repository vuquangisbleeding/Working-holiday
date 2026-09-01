import { callBridge } from "./bridge";
import { addLog, withStuck } from "./log";
import { hasSuffix, RUN_KEY, sleep } from "./state";

export function isChallengeCaptcha(): boolean {
  const url = location.href.toLowerCase();
  if (url.includes("rs-captcha") || url.includes("/captcha")) return true;
  return Array.from(document.querySelectorAll("iframe")).some((f) => {
    const src = (f.src || "").toLowerCase();
    const title = (f.title || "").toLowerCase();
    const st = getComputedStyle(f);
    if (st.display === "none" || !f.offsetParent) return false;
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
  const ta = document.querySelector("#g-recaptcha-response, textarea[name='g-recaptcha-response']");
  return !(ta && String((ta as HTMLTextAreaElement).value || "").trim().length > 10);
}

function onSubmitFlow(): boolean {
  return location.href.toLowerCase().includes("submit.aspx") || hasSuffix("falseStatementCheckBox");
}

function isFullPageCaptcha(): boolean {
  const url = location.href.toLowerCase();
  return url.includes("rs-captcha") || (url.includes("/captcha") && !url.includes("submit.aspx"));
}

function captchaBlocking(includeSubmitWidget: boolean): boolean {
  if (isFullPageCaptcha()) return true;
  if (hasSuffix("falseStatementCheckBox") && !includeSubmitWidget) return false;
  if (isChallengeCaptcha()) return true;
  return !!(includeSubmitWidget && onSubmitFlow() && recaptchaNeedsUser());
}

export async function tickYesNow(): Promise<Record<string, unknown> | null> {
  if (!hasSuffix("falseStatementCheckBox")) return null;
  try {
    return await callBridge("tickDeclaration");
  } catch {
    return null;
  }
}

export async function waitCaptcha(includeSubmitWidget = false): Promise<void> {
  if (!captchaBlocking(includeSubmitWidget)) return;
  dumpCaptchaInfo();
  const started = Date.now();
  addLog("CAPTCHA", includeSubmitWidget ? "Chờ reCAPTCHA trước SUBMIT" : "Chờ captcha (đã tick Yes nếu có)");
  await withStuck(includeSubmitWidget ? "chờ reCAPTCHA SUBMIT" : "chờ captcha", async () => {
    while (sessionStorage.getItem(RUN_KEY) === "1" && captchaBlocking(includeSubmitWidget)) {
      await tickYesNow();
      await sleep(400);
    }
  });
  addLog("CAPTCHA", "Xong captcha", Date.now() - started);
}

export async function waitNav(beforeUrl: string, timeout = 20000): Promise<boolean> {
  const { isHighLoad } = await import("./detect");
  return withStuck("chờ chuyển trang " + beforeUrl, async () => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (sessionStorage.getItem(RUN_KEY) !== "1") return false;
      if (location.href !== beforeUrl || isChallengeCaptcha() || isHighLoad()) return true;
      await sleep(120);
    }
    return location.href !== beforeUrl;
  });
}
