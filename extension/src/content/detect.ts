import { addLog } from "./log";
import { isChallengeCaptcha } from "./captcha";
import { hasSuffix, RUN_KEY, setStatus, sleep } from "./state";

function pageBlob(): string {
  const root = document.documentElement;
  return [
    document.title || "",
    (document.body && (document.body.innerText || document.body.textContent)) || "",
    (root && (root.innerText || root.textContent)) || "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isHighLoad(): boolean {
  const text = pageBlob();
  return (
    text.includes("site is under high load") ||
    text.includes("high demand on the system") ||
    text.includes("experiencing high demand") ||
    (text.includes("high load") && text.includes("try again later"))
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

export function detectPage(): string {
  const url = location.href;
  const body = (document.body && document.body.innerText) || "";
  if (isHighLoad()) return "highload";
  if (isQuotaClosed()) return "quota";
  if (url.includes("Personal1.aspx") || hasSuffix("familyNameTextBox")) return "personal1";
  if (url.includes("Personal2.aspx") || hasSuffix("passportNumberTextBox")) return "personal2";
  if (url.includes("Personal3.aspx")) return "personal3";
  if (url.includes("Medical1.aspx") || hasSuffix("renalDialysisDropDownList")) return "health";
  if (url.includes("Character.aspx") || hasSuffix("imprisonment5YearsDropDownList")) return "character";
  if (url.includes("WorkingHolidaySpecific.aspx") || hasSuffix("previousWhsPermitVisaDropDownList")) return "whs";
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
  if (url.includes("Submit.aspx") || hasSuffix("falseStatementCheckBox")) return "declaration";
  if (isChallengeCaptcha() && !hasSuffix("familyNameTextBox")) return "captcha";
  if (url.includes("OnlinePayment.aspx") || url.includes("OnLinePayment.aspx")) return "pay_next";
  if (document.querySelector('[name="username"]') && document.querySelector('[name="password"]')) return "login";
  if (document.querySelector("a[id^='ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_']")) {
    return "existing";
  }
  if (document.getElementById("ContentPlaceHolder1_applyNowButton")) return "apply";
  if (document.querySelector("[id^='ContentPlaceHolder1_countryRepeater_countryName_']")) return "country";
  return "unknown";
}

const HL_RELOAD_KEY = "whsHlReloading";

export async function recoverHighLoad(stopRun: () => void): Promise<boolean> {
  if (!isHighLoad()) {
    sessionStorage.removeItem("whsHighLoadTries");
    sessionStorage.removeItem(HL_RELOAD_KEY);
    return false;
  }
  if (isQuotaClosed()) {
    setStatus("Scheme đã hết chỗ / đóng. Incomplete không giữ slot.", "err");
    stopRun();
    return true;
  }
  if (sessionStorage.getItem(HL_RELOAD_KEY) === "1") return true;
  const n = Number(sessionStorage.getItem("whsHighLoadTries") || "0") + 1;
  sessionStorage.setItem("whsHighLoadTries", String(n));
  sessionStorage.setItem(HL_RELOAD_KEY, "1");
  if (n > 1) {
    const inApp = /applicationid=/i.test(location.href);
    const wait = inApp ? Math.min(400 * n, 3000) : Math.min(800 * n, 5000);
    addLog("HIGH_LOAD", "F5 sau " + (wait / 1000).toFixed(1) + "s (lần " + n + ")");
    await sleep(wait);
  } else {
    addLog("HIGH_LOAD", "F5 ngay");
  }
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
  highLoadWatch = window.setInterval(() => {
    if (sessionStorage.getItem(RUN_KEY) !== "1") return;
    if (!isHighLoad()) {
      sessionStorage.removeItem(HL_RELOAD_KEY);
      return;
    }
    void recoverHighLoad(stopRun);
  }, 300);
}
