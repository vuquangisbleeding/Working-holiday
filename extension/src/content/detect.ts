import { addLog } from "./log";
import { isCaptchaUrl, isChallengeCaptcha } from "./captcha";
import { hasSuffix, RUN_KEY, setStatus, sleep, HL_LAST_AT_KEY, wasAnyClickRecently } from "./state";

function pagePath(): string {
  return location.pathname.toLowerCase();
}

function pageBlob(): string {
  const parts = [document.title || ""];
  const body = document.body;
  if (body) {
    for (const child of Array.from(body.childNodes)) {
      if (child instanceof HTMLElement && child.id === "whs-panel") continue;
      parts.push((child as HTMLElement).innerText || child.textContent || "");
    }
  }
  return parts.join(" ").toLowerCase();
}

function isTryAgainLater(): boolean {
  const compact = pageBlob().replace(/\s+/g, " ").trim();
  if (!compact.includes("try again later")) return false;
  if (
    hasSuffix(
      "familyNameTextBox",
      "passportNumberTextBox",
      "falseStatementCheckBox",
      "previousWhsPermitVisaDropDownList",
    )
  ) {
    return false;
  }
  const leftover = compact
    .replace(/please try again later\.?/g, "")
    .replace(/try again later\.?/g, "")
    .replace(/new zealand immigration/g, "")
    .replace(/immigration new zealand/g, "")
    .trim();
  return leftover.length < 160;
}

export function isHighLoad(): boolean {
  if (
    hasSuffix(
      "familyNameTextBox",
      "passportNumberTextBox",
      "imprisonment5YearsDropDownList",
      "previousWhsPermitVisaDropDownList",
      "falseStatementCheckBox",
      "payerNameTextBox",
    )
  ) {
    return false;
  }
  const text = pageBlob();
  return (
    text.includes("site is under high load") ||
    text.includes("high demand on the system") ||
    text.includes("experiencing high demand") ||
    (text.includes("high load") && text.includes("try again later")) ||
    isTryAgainLater()
  );
}

export function isAccessDenied(): boolean {
  const text = pageBlob();
  return (
    text.includes("access denied") &&
    (text.includes("denied access to this page") ||
      text.includes("session has timed-out") ||
      text.includes("you don't have 'cookies' enabled") ||
      text.includes("you don’t have 'cookies' enabled"))
  );
}

export function isQuotaClosed(): boolean {
  const text = pageBlob();
  return [
    "no places available",
    "no places left",
    "no places remaining",
    "quota has been filled",
    "quota is filled",
    "places have been filled",
    "all places have been taken",
    "applications are no longer being accepted",
    "no longer accepting applications",
    "no longer being accepted",
  ].some((n) => text.includes(n));
}

function buttonTextHit(needles: string[]): boolean {
  return Array.from(document.querySelectorAll("input, button, a")).some((el) => {
    const blob = (
      ((el as HTMLInputElement).value || "") +
      " " +
      (el.textContent || "") +
      " " +
      el.id +
      " " +
      (el.title || "")
    )
      .replace(/\s+/g, " ")
      .toUpperCase();
    return needles.some((n) => blob.includes(n));
  });
}

function hasPayerNameField(): boolean {
  if (document.querySelector("[id*='ayerName'], [id$='payerName'], [id*='PayerName']")) return true;
  return Array.from(document.querySelectorAll("label")).some((l) => /payer\s*name/i.test(l.textContent || ""));
}

function hasPaymentGatewayLink(): boolean {
  return !!(
    document.getElementById("ContentPlaceHolder1_onlinePaymentAnchor2") ||
    document.querySelector("a[id*='onlinePaymentAnchor']") ||
    document.querySelector("a[href*='PaymentGateway/OnLinePayment']") ||
    document.querySelector("a[href*='OnLinePayment.aspx']")
  );
}

function isCardGateway(): boolean {
  const url = location.href.toLowerCase();
  if (/\/wizard\//i.test(url) || /personal\d\.aspx/i.test(url) || /medical1\.aspx/i.test(url) || /character\.aspx/i.test(url)) {
    return false;
  }
  if (/paystation|paymark|paymentexpress|pxpay/.test(url)) return true;
  if (document.querySelector("[autocomplete='cc-number'], input[id*='cardNumber'], input[name*='cardNumber']")) {
    return true;
  }
  return !!document.querySelector("iframe[src*='paystation'], iframe[src*='paymark'], iframe[src*='paymentexpress']");
}

export function findPaymentUrl(): string {
  const href = location.href;
  if (/payments\.paystation\.co\.nz\/hosted/i.test(href)) return href;
  const frames = Array.from(document.querySelectorAll("iframe")) as HTMLIFrameElement[];
  for (const f of frames) {
    const src = f.src || f.getAttribute("src") || "";
    if (/paystation\.co\.nz\/hosted/i.test(src)) return src;
  }
  const links = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  for (const a of links) {
    if (/paystation\.co\.nz\/hosted/i.test(a.href)) return a.href;
  }
  return href;
}

export function isPaystationHost(): boolean {
  return /paystation\.co\.nz/i.test(location.hostname);
}

export function isHostedPayUrl(url: string): boolean {
  return /payments\.paystation\.co\.nz\/hosted/i.test(url);
}

export function detectPage(): string {
  const url = location.href;
  const path = pagePath();
  const body = (document.body && document.body.innerText) || "";
  if (isCaptchaUrl()) return "captcha";
  if (isHighLoad()) return "highload";
  if (isAccessDenied()) return "denied";
  if (isQuotaClosed()) return "quota";
  if (path.includes("personal1.aspx") || hasSuffix("familyNameTextBox")) return "personal1";
  if (path.includes("personal2.aspx") || hasSuffix("passportNumberTextBox")) return "personal2";
  if (path.includes("personal3.aspx")) return "personal3";
  if (path.includes("medical1.aspx") || hasSuffix("renalDialysisDropDownList")) return "health";
  if (path.includes("character.aspx") || hasSuffix("imprisonment5YearsDropDownList")) return "character";
  if (path.includes("workingholidayspecific.aspx") || hasSuffix("previousWhsPermitVisaDropDownList")) return "whs";
  if (isCardGateway() && !hasPayerNameField()) return "pay_card";
  if (hasPayerNameField()) return "payer";
  if (hasPaymentGatewayLink() || buttonTextHit(["NEXT STEP"]) || buttonTextHit(["SECURE PAYMENT"])) return "pay_next";
  if (
    (url.toLowerCase().includes("submit.aspx") && url.toLowerCase().includes("token=")) ||
    (/PAY NOW/i.test(body) && /SUBMIT RECEIVED/i.test(body)) ||
    (buttonTextHit(["PAY NOW"]) && buttonTextHit(["PAY LATER"]))
  ) {
    return "pay_now";
  }
  if (path.includes("submit.aspx") || hasSuffix("falseStatementCheckBox")) return "declaration";
  if (isChallengeCaptcha() && !hasSuffix("familyNameTextBox")) return "captcha";
  if (path.includes("onlinepayment.aspx")) return "pay_next";
  if (document.querySelector('[name="username"]') && document.querySelector('[name="password"]')) return "login";
  if (document.querySelector("a[id^='ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_']")) {
    return "existing";
  }
  if (document.getElementById("ContentPlaceHolder1_applyNowButton")) return "apply";
  if (document.querySelector("[id^='ContentPlaceHolder1_countryRepeater_countryName_']")) return "country";
  return "unknown";
}

const HL_RELOAD_KEY = "whsHlReloading";
const HL_MIN_GAP_MS = 1500;

function pageLooksEmpty(): boolean {
  if (document.readyState === "loading") return true;
  const compact = pageBlob().replace(/\s+/g, " ").trim();
  return compact.length < 8;
}

export async function recoverHighLoad(stopRun: () => void): Promise<boolean> {
  if (!isHighLoad()) {
    if (!pageLooksEmpty()) {
      sessionStorage.removeItem("whsHighLoadTries");
      sessionStorage.removeItem(HL_RELOAD_KEY);
    }
    return false;
  }
  if (isQuotaClosed()) {
    setStatus("Scheme đã hết chỗ / đóng. Incomplete không giữ slot.", "err");
    stopRun();
    return true;
  }
  if (wasAnyClickRecently(3000)) return false;
  if (sessionStorage.getItem(HL_RELOAD_KEY) === "1") return true;
  const n = Number(sessionStorage.getItem("whsHighLoadTries") || "0") + 1;
  sessionStorage.setItem("whsHighLoadTries", String(n));
  sessionStorage.setItem(HL_RELOAD_KEY, "1");
  const kind = isTryAgainLater() ? "TRY_AGAIN" : "HIGH_LOAD";
  const lastAt = Number(sessionStorage.getItem(HL_LAST_AT_KEY) || "0");
  const since = Date.now() - lastAt;
  const inApp = /applicationid=/i.test(location.href);
  const backoff = n === 1 ? (isTryAgainLater() ? 800 : 400) : inApp ? Math.min(400 * n, 3000) : Math.min(800 * n, 5000);
  const wait = Math.max(backoff, lastAt ? Math.max(0, HL_MIN_GAP_MS - since) : backoff);
  addLog(kind, "F5 sau " + (wait / 1000).toFixed(1) + "s (lần " + n + ")");
  if (wait > 0) await sleep(wait);
  sessionStorage.setItem(HL_LAST_AT_KEY, String(Date.now()));
  try {
    location.reload();
  } catch {
    location.replace(location.href);
  }
  return true;
}

let highLoadWatch: number | undefined;

export function startHighLoadWatch(stopRun: () => void): void {
  if (highLoadWatch) return;
  sessionStorage.removeItem(HL_RELOAD_KEY);
  highLoadWatch = window.setInterval(() => {
    if (sessionStorage.getItem(RUN_KEY) !== "1") return;
    if (!isHighLoad()) {
      if (!pageLooksEmpty()) sessionStorage.removeItem(HL_RELOAD_KEY);
      return;
    }
    void recoverHighLoad(stopRun);
  }, 300);
}
