"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // extension/src/content/state.ts
  function setPanel(el) {
    panel = el;
  }
  function shortUrl(url) {
    try {
      const u = new URL(url);
      return u.pathname.split("/").pop() + u.search.replace(/&?rqs=[^&]*/g, "");
    } catch {
      return url;
    }
  }
  function hasSuffix(...suffixes) {
    return suffixes.some((s) => document.querySelector('[id$="' + s + '"]'));
  }
  function clickCooldownMs(op) {
    if (op === "clickSubmit" || op === "clickLogin") return 4e3;
    if (op === "clickApplyNow" || op === "clickEdit" || op === "clickPayNow") return 2500;
    return 1500;
  }
  function lastClickAt() {
    try {
      const g = JSON.parse(sessionStorage.getItem(CLICK_GUARD_KEY) || "null");
      return Number(g?.t || 0);
    } catch {
      return 0;
    }
  }
  function wasAnyClickRecently(ms = 3e3) {
    const t = lastClickAt();
    return !!t && Date.now() - t < ms;
  }
  function wasClickedRecently(op) {
    try {
      const g = JSON.parse(sessionStorage.getItem(CLICK_GUARD_KEY) || "null");
      if (!g || g.op !== op || g.url !== location.href) return false;
      return Date.now() - Number(g.t || 0) < clickCooldownMs(op);
    } catch {
      return false;
    }
  }
  function markClicked(op) {
    sessionStorage.setItem(CLICK_GUARD_KEY, JSON.stringify({ op, url: location.href, t: Date.now() }));
  }
  function formatClock(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "0.00s";
    if (ms < 6e4) return (ms / 1e3).toFixed(2) + "s";
    const minutes = Math.floor(ms / 6e4);
    const seconds = ms % 6e4 / 1e3;
    return minutes + "m " + seconds.toFixed(2).padStart(5, "0") + "s";
  }
  function beginCaptchaWait() {
    if (!sessionStorage.getItem(CAPTCHA_WAIT_KEY)) sessionStorage.setItem(CAPTCHA_WAIT_KEY, String(Date.now()));
  }
  function endCaptchaWait() {
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
  function captchaLiveMs() {
    const total = Number(sessionStorage.getItem(CAPTCHA_TOTAL_KEY) || "0");
    const start = Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0");
    const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
    const live = start && start >= t0 ? Math.max(0, Date.now() - start) : 0;
    return total + live;
  }
  function captchaLiveCount() {
    const n = Number(sessionStorage.getItem(CAPTCHA_COUNT_KEY) || "0");
    const start = Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0");
    const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
    return n + (start && start >= t0 ? 1 : 0);
  }
  function timingSummary() {
    const t0 = Number(sessionStorage.getItem(T0_KEY) || Date.now());
    const total = Math.max(0, Date.now() - t0);
    const captcha = Math.min(total, captchaLiveMs());
    const bot = Math.max(0, total - captcha);
    return formatTimingLine(total, bot, captcha, captchaLiveCount());
  }
  function formatTimingLine(totalMs, botMs, captchaMs, count) {
    return "T\u1ED5ng " + formatClock(totalMs) + " (bot " + formatClock(botMs) + " + captcha " + formatClock(captchaMs) + ", " + count + " l\u1EA7n)";
  }
  function persistTiming() {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const t0 = Number(sessionStorage.getItem(T0_KEY) || "0");
    if (!t0) return;
    const payload = {
      whsT0: t0,
      whsCaptchaTotal: Number(sessionStorage.getItem(CAPTCHA_TOTAL_KEY) || "0"),
      whsCaptchaCount: Number(sessionStorage.getItem(CAPTCHA_COUNT_KEY) || "0"),
      whsCaptchaWait: Number(sessionStorage.getItem(CAPTCHA_WAIT_KEY) || "0"),
      whsRunActive: sessionStorage.getItem(RUN_KEY) === "1"
    };
    void chrome.storage.local.get(["whsT0"], (cur) => {
      if (Number(cur.whsT0 || 0) > t0) return;
      void chrome.storage.local.set(payload);
    });
  }
  function timingFromPersisted(data) {
    const t0 = Number(data.whsT0 || Date.now());
    const total = Math.max(0, Date.now() - t0);
    const waitStart = Number(data.whsCaptchaWait || 0);
    const live = waitStart && waitStart >= t0 ? Math.max(0, Date.now() - waitStart) : 0;
    const captcha = Math.min(total, Number(data.whsCaptchaTotal || 0) + live);
    const count = Number(data.whsCaptchaCount || 0) + (live ? 1 : 0);
    return formatTimingLine(total, Math.max(0, total - captcha), captcha, count);
  }
  function resetTiming() {
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
        whsCaptchaTotal: 0,
        whsCaptchaCount: 0,
        whsCaptchaWait: 0,
        whsT0: Number(sessionStorage.getItem(T0_KEY) || Date.now())
      });
    }
  }
  function setStatus(text, cls = "") {
    const el = panel?.querySelector(".whs-status");
    if (!el) return;
    el.className = "whs-status" + (cls ? " " + cls : "");
    el.textContent = text;
  }
  function setActivity(page, action) {
    activity = { page, action };
  }
  function describeActivity() {
    const page = activity.page || shortUrl(location.href);
    const action = activity.action ? " | " + activity.action : "";
    return page + action;
  }
  var RUN_KEY, LOG_KEY, T0_KEY, LAST_PAGE_KEY, MAX_PAGES, CLICK_GUARD_KEY, HL_LAST_AT_KEY, CAPTCHA_TOTAL_KEY, CAPTCHA_COUNT_KEY, CAPTCHA_WAIT_KEY, panel, sleep, activity;
  var init_state = __esm({
    "extension/src/content/state.ts"() {
      "use strict";
      RUN_KEY = "whsAutoRun";
      LOG_KEY = "whsRunLog";
      T0_KEY = "whsRunT0";
      LAST_PAGE_KEY = "whsLastPage";
      MAX_PAGES = 40;
      CLICK_GUARD_KEY = "whsClickGuard";
      HL_LAST_AT_KEY = "whsHlLastAt";
      CAPTCHA_TOTAL_KEY = "whsCaptchaTotalMs";
      CAPTCHA_COUNT_KEY = "whsCaptchaCount";
      CAPTCHA_WAIT_KEY = "whsCaptchaWaitStart";
      sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      activity = { page: "", action: "" };
    }
  });

  // extension/src/content/log.ts
  function padMs(d) {
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0") + "." + String(d.getMilliseconds()).padStart(3, "0");
  }
  function formatDur(ms) {
    if (ms == null || ms < 0) return "";
    if (ms < 1e3) return Math.round(ms) + "ms";
    return (ms / 1e3).toFixed(2) + "s";
  }
  function loadLog() {
    try {
      return JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
    } catch {
      return [];
    }
  }
  function logLine(entry) {
    const dur = entry.dur ? "  " + entry.dur : "";
    return "[" + entry.t + "  +" + entry.elapsed + "s] " + entry.kind + " \u2014 " + entry.text + dur;
  }
  function renderLog() {
    const box = panel?.querySelector(".whs-log");
    if (!box) return;
    box.textContent = loadLog().map(logLine).join("\n") || "Ch\u01B0a c\xF3 log. B\u1EA5m Ch\u1EA1y.";
    box.scrollTop = box.scrollHeight;
    renderClock();
  }
  function renderClock() {
    const el = panel?.querySelector(".whs-clock");
    if (!el) return;
    if (!sessionStorage.getItem(T0_KEY)) {
      el.textContent = "";
      return;
    }
    el.textContent = timingSummary();
    persistTiming();
  }
  function startClock() {
    renderClock();
    if (clockTimer) return;
    clockTimer = window.setInterval(renderClock, 250);
  }
  function stopClock() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = void 0;
    }
    renderClock();
  }
  function addLog(kind, text, durMs) {
    const t0 = Number(sessionStorage.getItem(T0_KEY) || Date.now());
    if (!sessionStorage.getItem(T0_KEY)) sessionStorage.setItem(T0_KEY, String(t0));
    const entry = {
      t: padMs(/* @__PURE__ */ new Date()),
      elapsed: ((Date.now() - t0) / 1e3).toFixed(2),
      kind,
      text: String(text || ""),
      dur: formatDur(durMs)
    };
    const rows = loadLog();
    rows.push(entry);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-250)));
    renderLog();
    const cls = kind === "ERR" ? "err" : kind === "CAPTCHA" || kind === "HIGH_LOAD" || kind === "TRY_AGAIN" || kind === "STUCK" ? "pause" : "";
    setStatus(kind + ": " + entry.text + (entry.dur ? " (" + entry.dur + ")" : ""), cls);
  }
  function resetLog() {
    resetTiming();
    sessionStorage.setItem(LOG_KEY, "[]");
    sessionStorage.removeItem(LAST_PAGE_KEY);
    renderLog();
  }
  function copyLog() {
    const lines = loadLog().map(logLine);
    if (sessionStorage.getItem(T0_KEY)) lines.push(timingSummary());
    const text = lines.join("\n");
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => setStatus("\u0110\xE3 copy log.", "ok"),
      () => setStatus("Copy th\u1EA5t b\u1EA1i.", "err")
    );
  }
  function watchStuck(label) {
    const started = Date.now();
    const fired = /* @__PURE__ */ new Set();
    const id = setInterval(() => {
      const s = (Date.now() - started) / 1e3;
      if (s >= 1 && !fired.has(1)) {
        fired.add(1);
        addLog("STUCK", label + " >1s tr\xEAn " + describeActivity() + " (" + s.toFixed(1) + "s)");
      } else if (s >= 2 && !fired.has(2)) {
        fired.add(2);
        addLog("STUCK", label + " >2s tr\xEAn " + describeActivity() + " (" + s.toFixed(1) + "s)");
      } else if (s >= 4) {
        const bucket = Math.floor(s / 2) * 2;
        if (!fired.has(bucket)) {
          fired.add(bucket);
          addLog("STUCK", label + " v\u1EABn ch\u1EDD " + s.toFixed(1) + "s tr\xEAn " + describeActivity());
        }
      }
    }, 200);
    return () => clearInterval(id);
  }
  async function withStuck(label, fn) {
    const stop = watchStuck(label);
    try {
      return await fn();
    } finally {
      stop();
    }
  }
  var clockTimer;
  var init_log = __esm({
    "extension/src/content/log.ts"() {
      "use strict";
      init_state();
    }
  });

  // extension/src/content/bridge.ts
  async function injectBridge() {
    try {
      await callBridge("ping");
      return;
    } catch {
    }
    if (document.documentElement.dataset.whsBridge === "1") return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("page-bridge.js");
      s.onload = () => {
        document.documentElement.dataset.whsBridge = "1";
        resolve();
      };
      s.onerror = () => reject(new Error("Kh\xF4ng n\u1EA1p \u0111\u01B0\u1EE3c page-bridge.js"));
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function callBridge(op, payload) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      let done = false;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener("whs-bridge-result", onResult);
        fn(value);
      };
      const onResult = (e) => {
        const detail = e.detail;
        if (!detail || detail.id !== id) return;
        const result = detail.result;
        if (result && result.error) finish(reject, new Error(result.error));
        else finish(resolve, result);
      };
      const timer = setTimeout(() => finish(reject, new Error("Bridge timeout: " + op)), 8e3);
      document.addEventListener("whs-bridge-result", onResult);
      document.dispatchEvent(new CustomEvent("whs-bridge", { detail: { id, op, payload } }));
    });
  }
  function job(kind, value, suffixes, optional = false) {
    return {
      kind,
      value: value == null ? "" : String(value),
      suffixes: Array.isArray(suffixes) ? suffixes : [suffixes],
      optional
    };
  }
  async function waitPostback() {
    await withStuck("ch\u1EDD postback | " + shortUrl(location.href), async () => {
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
      const end = Date.now() + 15e3;
      while (Date.now() < end) {
        const still = await callBridge("inPostback");
        if (!still || !still.yes) break;
        await new Promise((res) => setTimeout(res, 50));
      }
    });
  }
  var seq;
  var init_bridge = __esm({
    "extension/src/content/bridge.ts"() {
      "use strict";
      init_log();
      init_state();
      seq = 0;
    }
  });

  // extension/src/content/detect.ts
  var detect_exports = {};
  __export(detect_exports, {
    detectPage: () => detectPage,
    findPaymentUrl: () => findPaymentUrl,
    isAccessDenied: () => isAccessDenied,
    isHighLoad: () => isHighLoad,
    isHostedPayUrl: () => isHostedPayUrl,
    isPaystationHost: () => isPaystationHost,
    isQuotaClosed: () => isQuotaClosed,
    recoverHighLoad: () => recoverHighLoad,
    startHighLoadWatch: () => startHighLoadWatch
  });
  function pagePath() {
    return location.pathname.toLowerCase();
  }
  function pageBlob() {
    const parts = [document.title || ""];
    const body = document.body;
    if (body) {
      for (const child of Array.from(body.childNodes)) {
        if (child instanceof HTMLElement && child.id === "whs-panel") continue;
        parts.push(child.innerText || child.textContent || "");
      }
    }
    return parts.join(" ").toLowerCase();
  }
  function isTryAgainLater() {
    const compact = pageBlob().replace(/\s+/g, " ").trim();
    if (!compact.includes("try again later")) return false;
    if (hasSuffix(
      "familyNameTextBox",
      "passportNumberTextBox",
      "falseStatementCheckBox",
      "previousWhsPermitVisaDropDownList"
    )) {
      return false;
    }
    const leftover = compact.replace(/please try again later\.?/g, "").replace(/try again later\.?/g, "").replace(/new zealand immigration/g, "").replace(/immigration new zealand/g, "").trim();
    return leftover.length < 160;
  }
  function isHighLoad() {
    if (hasSuffix(
      "familyNameTextBox",
      "passportNumberTextBox",
      "imprisonment5YearsDropDownList",
      "previousWhsPermitVisaDropDownList",
      "falseStatementCheckBox",
      "payerNameTextBox"
    )) {
      return false;
    }
    const text = pageBlob();
    return text.includes("site is under high load") || text.includes("high demand on the system") || text.includes("experiencing high demand") || text.includes("high load") && text.includes("try again later") || isTryAgainLater();
  }
  function isAccessDenied() {
    const text = pageBlob();
    return text.includes("access denied") && (text.includes("denied access to this page") || text.includes("session has timed-out") || text.includes("you don't have 'cookies' enabled") || text.includes("you don\u2019t have 'cookies' enabled"));
  }
  function isQuotaClosed() {
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
      "no longer being accepted"
    ].some((n) => text.includes(n));
  }
  function buttonTextHit(needles) {
    return Array.from(document.querySelectorAll("input, button, a")).some((el) => {
      const blob = ((el.value || "") + " " + (el.textContent || "") + " " + el.id + " " + (el.title || "")).replace(/\s+/g, " ").toUpperCase();
      return needles.some((n) => blob.includes(n));
    });
  }
  function hasPayerNameField() {
    if (document.querySelector("[id*='ayerName'], [id$='payerName'], [id*='PayerName']")) return true;
    return Array.from(document.querySelectorAll("label")).some((l) => /payer\s*name/i.test(l.textContent || ""));
  }
  function hasPaymentGatewayLink() {
    return !!(document.getElementById("ContentPlaceHolder1_onlinePaymentAnchor2") || document.querySelector("a[id*='onlinePaymentAnchor']") || document.querySelector("a[href*='PaymentGateway/OnLinePayment']") || document.querySelector("a[href*='OnLinePayment.aspx']"));
  }
  function isCardGateway() {
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
  function findPaymentUrl() {
    const href = location.href;
    if (/payments\.paystation\.co\.nz\/hosted/i.test(href)) return href;
    const frames = Array.from(document.querySelectorAll("iframe"));
    for (const f of frames) {
      const src = f.src || f.getAttribute("src") || "";
      if (/paystation\.co\.nz\/hosted/i.test(src)) return src;
    }
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const a of links) {
      if (/paystation\.co\.nz\/hosted/i.test(a.href)) return a.href;
    }
    return href;
  }
  function isPaystationHost() {
    return /paystation\.co\.nz/i.test(location.hostname);
  }
  function isHostedPayUrl(url) {
    return /payments\.paystation\.co\.nz\/hosted/i.test(url);
  }
  function detectPage() {
    const url = location.href;
    const path = pagePath();
    const body = document.body && document.body.innerText || "";
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
    if (url.toLowerCase().includes("submit.aspx") && url.toLowerCase().includes("token=") || /PAY NOW/i.test(body) && /SUBMIT RECEIVED/i.test(body) || buttonTextHit(["PAY NOW"]) && buttonTextHit(["PAY LATER"])) {
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
  function pageLooksEmpty() {
    if (document.readyState === "loading") return true;
    const compact = pageBlob().replace(/\s+/g, " ").trim();
    return compact.length < 8;
  }
  async function recoverHighLoad(stopRun2) {
    if (!isHighLoad()) {
      if (!pageLooksEmpty()) {
        sessionStorage.removeItem("whsHighLoadTries");
        sessionStorage.removeItem(HL_RELOAD_KEY);
      }
      return false;
    }
    if (isQuotaClosed()) {
      setStatus("Scheme \u0111\xE3 h\u1EBFt ch\u1ED7 / \u0111\xF3ng. Incomplete kh\xF4ng gi\u1EEF slot.", "err");
      stopRun2();
      return true;
    }
    if (wasAnyClickRecently(3e3)) return false;
    if (sessionStorage.getItem(HL_RELOAD_KEY) === "1") return true;
    const n = Number(sessionStorage.getItem("whsHighLoadTries") || "0") + 1;
    sessionStorage.setItem("whsHighLoadTries", String(n));
    sessionStorage.setItem(HL_RELOAD_KEY, "1");
    const kind = isTryAgainLater() ? "TRY_AGAIN" : "HIGH_LOAD";
    const lastAt = Number(sessionStorage.getItem(HL_LAST_AT_KEY) || "0");
    const since = Date.now() - lastAt;
    const inApp = /applicationid=/i.test(location.href);
    const backoff = n === 1 ? isTryAgainLater() ? 800 : 400 : inApp ? Math.min(400 * n, 3e3) : Math.min(800 * n, 5e3);
    const wait = Math.max(backoff, lastAt ? Math.max(0, HL_MIN_GAP_MS - since) : backoff);
    addLog(kind, "F5 sau " + (wait / 1e3).toFixed(1) + "s (l\u1EA7n " + n + ")");
    if (wait > 0) await sleep(wait);
    sessionStorage.setItem(HL_LAST_AT_KEY, String(Date.now()));
    try {
      location.reload();
    } catch {
      location.replace(location.href);
    }
    return true;
  }
  function startHighLoadWatch(stopRun2) {
    if (highLoadWatch) return;
    sessionStorage.removeItem(HL_RELOAD_KEY);
    highLoadWatch = window.setInterval(() => {
      if (sessionStorage.getItem(RUN_KEY) !== "1") return;
      if (!isHighLoad()) {
        if (!pageLooksEmpty()) sessionStorage.removeItem(HL_RELOAD_KEY);
        return;
      }
      void recoverHighLoad(stopRun2);
    }, 300);
  }
  var HL_RELOAD_KEY, HL_MIN_GAP_MS, highLoadWatch;
  var init_detect = __esm({
    "extension/src/content/detect.ts"() {
      "use strict";
      init_log();
      init_captcha();
      init_state();
      HL_RELOAD_KEY = "whsHlReloading";
      HL_MIN_GAP_MS = 1500;
    }
  });

  // extension/src/content/captcha.ts
  function isCaptchaUrl() {
    const url = location.href.toLowerCase();
    return url.includes("rs-captcha") || url.includes("/captcha") && !url.includes("submit.aspx");
  }
  function recaptchaSolved() {
    const nodes = document.querySelectorAll(
      "#g-recaptcha-response, textarea[name='g-recaptcha-response'], textarea.g-recaptcha-response, textarea[id*='g-recaptcha-response']"
    );
    for (const node of nodes) {
      if (String(node.value || "").trim().length > TOKEN_MIN) return true;
    }
    return false;
  }
  function isChallengeCaptcha() {
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
  function collectCaptchaInfo() {
    const pageURL = location.href;
    const keyed = document.querySelector("[data-sitekey]");
    let sitekey = keyed ? keyed.getAttribute("data-sitekey") || "" : "";
    if (!sitekey) {
      for (const f of document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"]')) {
        try {
          const u = new URL(f.src);
          sitekey = u.searchParams.get("k") || u.searchParams.get("render") || sitekey;
        } catch {
        }
      }
    }
    return { pageURL, sitekey: sitekey || "(kh\xF4ng th\u1EA5y data-sitekey)" };
  }
  function dumpCaptchaInfo() {
    const info = collectCaptchaInfo();
    console.log("[WHS CAPTCHA] pageURL:", info.pageURL);
    console.log("[WHS CAPTCHA] data-sitekey:", info.sitekey);
    addLog("CAPTCHA_INFO", "pageURL=" + info.pageURL + " | data-sitekey=" + info.sitekey);
  }
  function recaptchaNeedsUser() {
    const widget = document.querySelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]');
    if (!widget) return false;
    return !recaptchaSolved();
  }
  function onSubmitFlow() {
    return location.href.toLowerCase().includes("submit.aspx") || hasSuffix("falseStatementCheckBox");
  }
  function captchaBlocking(includeSubmitWidget) {
    if (recaptchaSolved()) return false;
    if (isCaptchaUrl()) return true;
    if (hasSuffix("falseStatementCheckBox") && !includeSubmitWidget) return false;
    if (isChallengeCaptcha()) return true;
    return !!(includeSubmitWidget && onSubmitFlow() && recaptchaNeedsUser());
  }
  async function tickYesNow() {
    if (!hasSuffix("falseStatementCheckBox")) return null;
    const unchecked = Array.from(document.querySelectorAll('input[type="checkbox"]')).some((el) => {
      const box = el;
      return box.type === "checkbox" && !box.disabled && !box.checked && /CheckBox$/i.test(box.id || "");
    });
    if (!unchecked) return { skipped: true, checked: 1 };
    try {
      return await callBridge("tickDeclaration");
    } catch {
      return null;
    }
  }
  async function inPostback() {
    try {
      const r = await callBridge("inPostback");
      return !!r?.yes;
    } catch {
      return false;
    }
  }
  async function pageLeft(beforeUrl) {
    if (location.href !== beforeUrl) return true;
    return inPostback();
  }
  async function clickAdvanceAfterCaptcha(preferSubmit, beforeUrl) {
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
    }
    return null;
  }
  function waitUntilSolvedOrUnblocked(includeSubmitWidget) {
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
  async function waitCaptcha(includeSubmitWidget = false, clickWhenSolved = true) {
    if (!captchaBlocking(includeSubmitWidget)) return false;
    dumpCaptchaInfo();
    beginCaptchaWait();
    const beforeUrl = location.href;
    addLog("CAPTCHA", includeSubmitWidget ? "Ch\u1EDD reCAPTCHA tr\u01B0\u1EDBc SUBMIT" : "Ch\u1EDD captcha (\u0111\xE3 tick Yes n\u1EBFu c\xF3)");
    try {
      await withStuck(
        includeSubmitWidget ? "ch\u1EDD reCAPTCHA SUBMIT" : "ch\u1EDD captcha",
        () => waitUntilSolvedOrUnblocked(includeSubmitWidget)
      );
      const waited = endCaptchaWait();
      if (waited >= 100) addLog("CAPTCHA", "Xong captcha", waited);
      if (sessionStorage.getItem(RUN_KEY) !== "1") return false;
      if (!clickWhenSolved) return false;
      const advanced = await clickAdvanceAfterCaptcha(includeSubmitWidget, beforeUrl);
      if (advanced?.ok && advanced.clicked !== "NAV") {
        const label = String(advanced.clicked || "NEXT");
        const id = advanced.id ? " #" + String(advanced.id).split("_").pop() : "";
        addLog("CLICK", "Captcha xong \u2014 b\u1EA5m " + label + id + " ngay");
      }
      return !!advanced?.ok;
    } finally {
      endCaptchaWait();
    }
  }
  async function waitNav(beforeUrl, timeout = 2e4) {
    const { isAccessDenied: isAccessDenied2, isHighLoad: isHighLoad2, findPaymentUrl: findPaymentUrl2, isHostedPayUrl: isHostedPayUrl2 } = await Promise.resolve().then(() => (init_detect(), detect_exports));
    let unloading = false;
    const onGone = () => {
      unloading = true;
    };
    window.addEventListener("pagehide", onGone);
    window.addEventListener("beforeunload", onGone);
    try {
      return await withStuck("ch\u1EDD chuy\u1EC3n trang " + beforeUrl, async () => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          if (sessionStorage.getItem(RUN_KEY) !== "1") return false;
          const pay = findPaymentUrl2();
          if (location.href !== beforeUrl || unloading || isChallengeCaptcha() || isHighLoad2() || isAccessDenied2() || pay !== beforeUrl && isHostedPayUrl2(pay) || !!document.querySelector("iframe[src*='paystation']")) {
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
  var TOKEN_MIN, POLL_MS;
  var init_captcha = __esm({
    "extension/src/content/captcha.ts"() {
      "use strict";
      init_bridge();
      init_log();
      init_state();
      TOKEN_MIN = 20;
      POLL_MS = 50;
      window.addEventListener("pagehide", () => {
        endCaptchaWait();
      });
    }
  });

  // extension/src/default-data.ts
  var DEFAULT_APPLICANT = {
    scheme_country: "JAPAN",
    personal: {
      country_of_birth: "Vietnam",
      date_of_birth: "2 December, 2000",
      family_name: "Ha Tinh",
      gender: "Male",
      given_name_1: "Oi",
      given_name_2: "",
      given_name_3: "",
      other_names: "",
      other_title: "",
      title: "Mr"
    },
    address: {
      city: "Ha Noi",
      country: "Vietnam",
      postal_code: "100000",
      province: "Ha Noi",
      street_name: "Xuan Dinh",
      street_number: "789",
      suburb: "Bac Tu Liem"
    },
    contact: {
      communication_method: "Email",
      email: "quangnv.ftuforum@gmail.com",
      fax: "",
      has_agent: "No",
      has_credit_card: "Yes",
      phone_daytime: "0942361202",
      phone_mobile: "+84942361202",
      phone_night: ""
    },
    identification: {
      id_expiry_date: "8 August, 2030",
      id_issue_date: "4 August, 2026",
      id_type: "National ID",
      passport_expiry: "28 August, 2031",
      passport_number: "E08977777"
    },
    occupation: {
      industry_search: "",
      occupation_search: ""
    },
    health: {
      active_tb: "No",
      cancer: "No",
      disability: "No",
      heart_disease: "No",
      hospitalisation: "No",
      medical_details: "",
      pregnancy: "No",
      renal_dialysis: "No",
      residential_care: "No",
      tb_risk: "Yes"
    },
    character: {
      charged: "No",
      convicted: "No",
      deported: "No",
      details: "",
      excluded: "No",
      imprisonment_12_months: "No",
      imprisonment_5_years: "No",
      removed: "No",
      under_investigation: "No"
    },
    whs: {
      previous_whs_visa: "No",
      sufficient_funds_holiday: "Yes",
      travel_date: "20 November, 2026",
      been_to_nz: "No",
      been_to_nz_when: "",
      sufficient_funds_onward_ticket: "Yes",
      meet_scheme_requirements: "Yes"
    },
    payment: {
      payer_name: "Vu Quang Nguyen"
    }
  };

  // extension/src/content.ts
  init_bridge();
  init_captcha();
  init_detect();

  // extension/src/content/fill.ts
  init_bridge();
  init_log();
  init_state();
  function fieldName(job2) {
    return job2.suffixes[0] || "?";
  }
  function logResult(job2, result) {
    const name = fieldName(job2);
    const value = job2.value === "" ? "(tr\u1ED1ng)" : job2.value;
    if (job2.optional && job2.value === "") {
      addLog("FILL", name + " (b\u1ECF qua, kh\xF4ng b\u1EAFt bu\u1ED9c)");
      return;
    }
    if (!result || result.skipped) {
      addLog("FILL", name + " = " + value + " (kh\xF4ng th\u1EA5y \xF4)");
      return;
    }
    if (result.unchanged) {
      addLog("FILL", name + " = " + value + " (\u0111\xE3 \u0111\xFAng)");
      return;
    }
    addLog("FILL", name + " = " + value);
  }
  async function fillJobs(jobs) {
    const r = await callBridge("fillMany", jobs);
    const items = Array.isArray(r.items) ? r.items : Array.isArray(r) ? r : [];
    jobs.forEach((j, i) => logResult(j, items[i]));
  }
  async function setSelectLogged(suffixes, value) {
    const name = suffixes[0] || "select";
    setActivity("", "\u0111i\u1EC1n " + name + " = " + value);
    const r = await callBridge("setSelect", { suffixes, value });
    logResult({ kind: "select", value, suffixes }, r);
    return !r.unchanged && !!r.ok;
  }
  async function fillPage(page, data) {
    const p = data.personal || {};
    const a = data.address || {};
    const c = data.contact || {};
    const id = data.identification || {};
    const h = data.health || {};
    const ch = data.character || {};
    const w = Object.assign(
      {
        previous_whs_visa: "No",
        sufficient_funds_holiday: "Yes",
        travel_date: "20 November, 2026",
        been_to_nz: "No",
        sufficient_funds_onward_ticket: "Yes",
        meet_scheme_requirements: "Yes"
      },
      data.whs || {}
    );
    if (page === "personal1") {
      if (await setSelectLogged(["representedByAgentDropdownlist"], c.has_agent || "No")) await waitPostback();
      await fillJobs([
        job("text", p.family_name, "familyNameTextBox"),
        job("text", p.given_name_1, ["givenName1Textbox", "givenName1TextBox"]),
        job("text", p.given_name_2, ["givenName2Textbox", "givenName2TextBox"], true),
        job("text", p.given_name_3, ["givenName3Textbox", "givenName3TextBox"], true),
        job("text", p.other_names, "otherNamesTextBox", true),
        job("select", p.title, "titleDropDownList"),
        job("text", p.other_title, "otherTitleTextBox", true),
        job("select", p.gender, "genderDropDownList"),
        job("text", p.date_of_birth, "dateOfBirthDatePicker_DatePicker"),
        job("select", p.country_of_birth, "personDetails_CountryDropDownList"),
        job("text", a.street_number, ["streetNumberTextbox", "streetNumberTextBox"]),
        job("text", a.street_name, "address1TextBox"),
        job("text", a.suburb, "suburbTextBox"),
        job("text", a.city, "cityTextBox"),
        job("text", a.province, "provinceStateTextBox"),
        job("text", a.postal_code, "postalCodeTextBox"),
        job("select", a.country, "address_countryDropDownList"),
        job("text", c.phone_daytime, "phoneNumberTextBox", true),
        job("text", c.phone_night, "phoneNumberNightTextBox", true),
        job("text", c.phone_mobile, "phoneNumberMobileTextBox"),
        job("text", c.fax, ["faxNumberTextbox", "faxNumberTextBox"], true),
        job("text", c.email, "emailAddressTextBox"),
        job("select", c.communication_method, "communicationMethodDropDownList"),
        job("select", c.has_credit_card, "hasCreditCardDropDownlist")
      ]);
      return "continue";
    }
    if (page === "personal2") {
      await fillJobs([
        job("text", id.passport_number, "passportNumberTextBox"),
        job("text", id.passport_number, "confirmPassportNumberTextBox"),
        job("text", id.passport_expiry, "passportExpiryDateDatePicker_DatePicker"),
        job("select", id.id_type, "otherIdentificationDropdownlist"),
        job("text", id.id_issue_date, "otherIssueDateDatePicker_DatePicker"),
        job("text", id.id_expiry_date, "otherExpiryDateDatePicker_DatePicker")
      ]);
      return "continue";
    }
    if (page === "health") {
      await fillJobs([
        job("select", h.renal_dialysis, "renalDialysisDropDownList"),
        job("select", h.active_tb, "tuberculosisDropDownList"),
        job("select", h.cancer, "cancerDropDownList"),
        job("select", h.heart_disease, "heartDiseaseDropDownList"),
        job("select", h.disability, "disabilityDropDownList"),
        job("select", h.hospitalisation, "hospitalisationDropDownList"),
        job("select", h.residential_care, ["residentailCareDropDownList", "residentialCareDropDownList"]),
        job("select", h.pregnancy || "No", "pregnancyStatusDropDownList", true)
      ]);
      if (await setSelectLogged(["tbRiskDropDownList"], h.tb_risk || "Yes")) await waitPostback();
      await fillJobs([job("text", h.medical_details, "medicalConditionsTextBox", true)]);
      return "continue";
    }
    if (page === "character") {
      await fillJobs([
        job("select", ch.imprisonment_5_years, "imprisonment5YearsDropDownList"),
        job("select", ch.imprisonment_12_months, "imprisonment12MonthsDropDownList"),
        job("select", ch.deported, "deportedDropDownList"),
        job("select", ch.removal_order || "No", "removalOrderDropDownList", true),
        job("select", ch.charged, "chargedDropDownList"),
        job("select", ch.convicted, "convictedDropDownList"),
        job("select", ch.under_investigation, "underInvestigationDropDownList"),
        job("select", ch.excluded, "excludedDropDownList"),
        job("select", ch.removed, "removedDropDownList"),
        job("text", ch.details, "characterDetailsTextBox", true)
      ]);
      return "continue";
    }
    if (page === "whs") {
      await fillJobs([
        job("select", w.previous_whs_visa, "previousWhsPermitVisaDropDownList"),
        job("select", w.sufficient_funds_holiday, "sufficientFundsHolidayDropDownList"),
        job("text", w.travel_date, "intendedTravelDateDatePicker_DatePicker")
      ]);
      if (await setSelectLogged(["beenToNzDropDownList"], w.been_to_nz)) await waitPostback();
      await fillJobs([
        job("text", w.been_to_nz_when, ["beenToNzDateDatePicker_DatePicker", "whenInNzDatePicker_DatePicker"], true),
        job("select", w.sufficient_funds_onward_ticket, "sufficientFundsOnwardTicketDropDownList"),
        job("select", w.meet_scheme_requirements, "readRequirementsDropDownList"),
        job("select", w.length_of_stay || "", "lengthOfStayDropDownList", true)
      ]);
      return "continue";
    }
    if (page === "personal3") return "continue";
    if (page === "declaration") {
      const r = await callBridge("tickDeclaration");
      setStatus("\u0110\xE3 tick " + (r.checked || 0) + "/" + (r.total || 0) + " \xF4 Yes");
      return "submit";
    }
    if (page === "pay_now") return "pay_now";
    if (page === "pay_next") return "pay_next";
    if (page === "payer") {
      const name = data.payment?.payer_name || data.payer_name || "Vu Quang Nguyen";
      const r = await callBridge("fillPayerName", { value: name });
      addLog("FILL", "Payer name: " + name + (r && r.ok ? "" : " (kh\xF4ng th\u1EA5y \xF4)"));
      return "payer_ok";
    }
    if (page === "pay_card") return "done_pay";
    if (page === "pay") return "pay_now";
    if (page === "payment") return "pay_next";
    return "unknown";
  }

  // extension/src/content.ts
  init_log();

  // extension/src/content/nav.ts
  init_bridge();
  init_captcha();
  init_log();
  init_state();
  function finishPendingNav() {
    const raw = sessionStorage.getItem("whsPendingNav");
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      addLog("NAV", (p.from || "") + " \u2192 " + shortUrl(location.href), Date.now() - p.t);
    } catch {
    }
    sessionStorage.removeItem("whsPendingNav");
  }
  function clickLabel(r, fallback) {
    const clicked = r?.clicked ? String(r.clicked) : fallback;
    const id = r?.id ? String(r.id).split("_").pop() : "";
    const value = r?.value ? String(r.value) : "";
    return clicked + (value ? ' "' + value + '"' : "") + (id ? " #" + id : "");
  }
  async function clickSubmitFallback() {
    addLog("CLICK", "Kh\xF4ng c\xF3 Next tr\xEAn " + shortUrl(location.href) + " \u2014 b\u1EA5m SUBMIT");
    setActivity(shortUrl(location.href), "b\u1EA5m SUBMIT");
    await tickYesNow();
    const clicked = await waitCaptcha(true);
    if (clicked) return { ok: true, clicked: "SUBMIT" };
    if (wasClickedRecently("clickSubmit")) return { ok: true, skipped: true };
    const sub = await callBridge("clickSubmit");
    if (sub?.ok) markClicked("clickSubmit");
    return sub;
  }
  async function advanceWithoutNext(before) {
    const canSubmit = await callBridge("hasSubmit");
    if (canSubmit?.ok) return clickSubmitFallback();
    addLog("CLICK", "Kh\xF4ng c\xF3 Next tr\xEAn " + shortUrl(before) + " \u2014 t\xECm SAVE");
    const save = await callBridge("clickSave");
    if (!save?.ok) return clickSubmitFallback();
    addLog("CLICK", "\u0110\xE3 b\u1EA5m " + clickLabel(save, "SAVE") + " v\xEC kh\xF4ng c\xF3 Next");
    await waitPostback();
    await waitCaptcha();
    const until = Date.now() + 1e4;
    while (Date.now() < until) {
      if (location.href !== before) {
        addLog("NAV", "SAVE \u0111\xE3 chuy\u1EC3n trang \u2192 " + shortUrl(location.href));
        return save;
      }
      const again = await callBridge("hasNext");
      if (again?.ok) {
        const next = await callBridge("clickNext");
        if (next?.ok) {
          addLog("CLICK", "B\u1EA5m " + clickLabel(next, "NEXT") + " sau SAVE");
          return next;
        }
      }
      await sleep(250);
    }
    addLog("CLICK", "SAVE xong, ch\u01B0a th\u1EA5y Next tr\xEAn " + shortUrl(location.href));
    return save;
  }
  async function clickAndWait(op, payload) {
    const before = location.href;
    const started = Date.now();
    const label = op.replace(/^click/i, "").toUpperCase();
    setActivity(shortUrl(before), "b\u1EA5m " + label);
    if (wasClickedRecently(op)) {
      addLog("CLICK", "Ch\u1EDD trang sau " + label + " (\u0111\xE3 b\u1EA5m tr\xEAn " + shortUrl(before) + ")");
      await waitNav(before);
      finishPendingNav();
      return { ok: true, skipped: true };
    }
    addLog("CLICK", "T\xECm " + label + " tr\xEAn " + shortUrl(before));
    sessionStorage.setItem(
      "whsPendingNav",
      JSON.stringify({ from: shortUrl(before), t: started, op: label })
    );
    let r = await withStuck("b\u1EA5m " + label + " | " + shortUrl(before), () => callBridge(op, payload));
    if (op === "clickNext" && (!r || !r.ok)) r = await advanceWithoutNext(before);
    if (r?.clicked === "SAVE" && location.href === before) {
      markClicked(op);
      finishPendingNav();
      return r;
    }
    if (!r || !r.ok) {
      sessionStorage.removeItem("whsPendingNav");
      addLog("ERR", "Kh\xF4ng b\u1EA5m \u0111\u01B0\u1EE3c " + label + " tr\xEAn " + shortUrl(location.href), Date.now() - started);
      return r;
    }
    markClicked(op);
    addLog("CLICK", "\u0110\xE3 b\u1EA5m " + clickLabel(r, label) + " tr\xEAn " + shortUrl(before));
    const clickAgain = op !== "clickSubmit" && op !== "clickPayNow" && op !== "clickPayLater" && op !== "clickOk";
    await waitCaptcha(false, clickAgain);
    const navTimeout = op === "clickOk" || op === "clickPayNow" || op === "clickNextStep" ? 45e3 : 2e4;
    await waitNav(before, navTimeout);
    finishPendingNav();
    return r;
  }

  // extension/src/content.ts
  init_state();

  // src/telegram/identity.ts
  function applicantIdentityLines(data) {
    const p = data?.personal;
    const name = [p?.family_name, p?.given_name_1, p?.given_name_2, p?.given_name_3].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
    const email = String(data?.contact?.email || "").trim();
    return [name ? "H\u1ECD t\xEAn: " + name : "", email ? "Email: " + email : ""].filter(Boolean);
  }

  // extension/src/content/telegram.ts
  init_log();
  async function notifyTelegram(payUrl, timing) {
    try {
      const stored = await chrome.storage.local.get(["telegram", "whsTelegramSent", "applicant"]);
      const tg = stored.telegram;
      if (stored.whsTelegramSent) return;
      if (!tg?.enabled) return;
      if (!tg.botToken || !tg.chatId) {
        addLog("TELEGRAM", "Thi\u1EBFu bot token ho\u1EB7c Chat ID trong Options");
        return;
      }
      const text = [
        "NZ WHS xong",
        ...applicantIdentityLines(stored.applicant),
        timing,
        payUrl || "(ch\u01B0a c\xF3 link Paystation)"
      ].filter(Boolean).join("\n");
      const result = await chrome.runtime.sendMessage({ type: "TELEGRAM", text });
      if (result?.ok) {
        await chrome.storage.local.set({ whsTelegramSent: true });
        addLog("TELEGRAM", "\u0110\xE3 g\u1EEDi Telegram");
        return;
      }
      addLog("TELEGRAM", "Kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c: " + (result?.error || "kh\xF4ng r\xF5"));
    } catch (err) {
      addLog("TELEGRAM", String(err instanceof Error ? err.message : err));
    }
  }

  // extension/src/content.ts
  var running = false;
  function setButtons(isRunning) {
    if (!panel) return;
    const run = panel.querySelector(".whs-run");
    const stop = panel.querySelector(".whs-stop");
    if (run) run.disabled = isRunning;
    if (stop) stop.disabled = !isRunning;
  }
  function stopRun() {
    if (sessionStorage.getItem(RUN_KEY) === "1" && sessionStorage.getItem(T0_KEY)) {
      persistTiming();
      addLog("SUMMARY", timingSummary());
    }
    sessionStorage.removeItem(RUN_KEY);
    running = false;
    setButtons(false);
    stopClock();
    persistTiming();
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      void chrome.storage.local.set({ whsRunActive: false });
    }
  }
  async function logPaymentAndStop() {
    persistTiming();
    const until = Date.now() + 2500;
    let url = findPaymentUrl();
    while (Date.now() < until && !isHostedPayUrl(url)) {
      await sleep(100);
      url = findPaymentUrl();
    }
    const line = timingSummary();
    if (isHostedPayUrl(url)) {
      console.log(url);
      console.log(line);
      addLog("PAY_LINK", url);
      try {
        await chrome.storage.local.set({ whsPayLogged: true });
      } catch {
      }
      await notifyTelegram(url, line);
    } else {
      console.log(line);
    }
    addLog("DONE", "\u0110\xE3 t\u1EDBi trang thanh to\xE1n \u2014 " + line);
    if (sessionStorage.getItem(RUN_KEY) === "1") stopRun();
  }
  async function announcePaystationArrival() {
    let stored = {};
    try {
      stored = await chrome.storage.local.get([
        "whsPayLogged",
        "whsT0",
        "whsRunActive",
        "whsCaptchaTotal",
        "whsCaptchaCount",
        "whsCaptchaWait"
      ]);
    } catch {
      return;
    }
    if (stored.whsPayLogged) return;
    if (!stored.whsT0 && !stored.whsRunActive) return;
    const url = findPaymentUrl();
    const line = timingFromPersisted(stored);
    console.log(url);
    console.log(line);
    addLog("PAY_LINK", url);
    addLog("SUMMARY", line);
    await notifyTelegram(url, line);
    try {
      await chrome.storage.local.set({ whsPayLogged: true, whsRunActive: false });
    } catch {
    }
  }
  async function loadApplicant() {
    const stored = await chrome.storage.local.get(["applicant", "credentials"]);
    return {
      applicant: stored.applicant || DEFAULT_APPLICANT,
      credentials: stored.credentials || {}
    };
  }
  async function stepOnce(data, creds) {
    if (hasSuffix("falseStatementCheckBox")) await tickYesNow();
    await waitCaptcha(false, false);
    if (await recoverHighLoad(stopRun)) return;
    const page = detectPage();
    setActivity(page + " | " + shortUrl(location.href), "nh\u1EADn di\u1EC7n trang");
    addLog("PAGE", page + " | " + shortUrl(location.href));
    sessionStorage.setItem(LAST_PAGE_KEY, page);
    if (page === "highload") {
      await recoverHighLoad(stopRun);
      return;
    }
    if (page === "quota") {
      addLog("ERR", "Scheme \u0111\xE3 h\u1EBFt ch\u1ED7 / \u0111\xF3ng");
      stopRun();
      return;
    }
    if (page === "denied") {
      addLog(
        "ERR",
        "INZ Access denied \u2014 th\u01B0\u1EDDng do SUBMIT/Next b\u1ECB b\u1EA5m 2 l\u1EA7n ho\u1EB7c token trang \u0111\xE3 d\xF9ng. \u0110\u1EEBng F5. \u0110\xF3ng h\u1EBFt c\u1EEDa s\u1ED5 Chrome, login l\u1EA1i, m\u1EDF Edit Incomplete."
      );
      stopRun();
      return;
    }
    if (page === "login") {
      const user = document.querySelector('[name="username"]');
      const pass = document.querySelector('[name="password"]');
      if (user && creds.username) {
        user.focus();
        user.value = creds.username;
        user.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (pass && creds.password) {
        pass.focus();
        pass.value = creds.password;
        pass.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (creds.username && creds.password) await clickAndWait("clickLogin");
      else {
        addLog("ERR", "Thi\u1EBFu username/password trong Options");
        stopRun();
      }
      return;
    }
    if (page === "existing") {
      await clickAndWait("clickEdit");
      return;
    }
    if (page === "apply") {
      await clickAndWait("clickApplyNow");
      return;
    }
    if (page === "country") {
      const country = data.scheme_country || "JAPAN";
      const before = location.href;
      if (wasClickedRecently("clickCountry")) {
        await waitNav(before);
        return;
      }
      const started = Date.now();
      addLog("COUNTRY", country);
      sessionStorage.setItem("whsPendingNav", JSON.stringify({ from: shortUrl(before), t: started, op: "COUNTRY" }));
      const r = await callBridge("clickCountry", { country });
      if (!r.ok) {
        sessionStorage.removeItem("whsPendingNav");
        addLog("ERR", "Kh\xF4ng t\xECm th\u1EA5y country " + country);
        stopRun();
        return;
      }
      markClicked("clickCountry");
      await sleep(200);
      await waitCaptcha();
      await waitNav(before);
      finishPendingNav();
      return;
    }
    if (page === "captcha") {
      const before = location.href;
      const clicked = await waitCaptcha();
      if (sessionStorage.getItem(RUN_KEY) !== "1") return;
      if (!clicked) await clickAndWait("clickNext");
      else await waitNav(before);
      return;
    }
    const fillStart = Date.now();
    setActivity(page + " | " + shortUrl(location.href), "\u0111i\u1EC1n " + page);
    const action = await withStuck("\u0111i\u1EC1n " + page + " | " + shortUrl(location.href), () => fillPage(page, data));
    addLog("FILL", "xong " + page, Date.now() - fillStart);
    if (action === "stop" || action === "unknown") {
      addLog("STOP", action === "unknown" ? "Trang ch\u01B0a h\u1ED7 tr\u1EE3" : "D\u1EEBng");
      stopRun();
      return;
    }
    if (action === "submit") {
      await tickYesNow();
      const clicked = await waitCaptcha(true);
      if (detectPage() === "pay_now" || detectPage() === "pay") {
        await clickAndWait("clickPayNow");
        return;
      }
      if (!clicked && detectPage() === "declaration") await clickAndWait("clickSubmit");
      await sleep(200);
      if (detectPage() === "pay_now" || detectPage() === "pay") await clickAndWait("clickPayNow");
      return;
    }
    if (action === "pay_now") {
      await clickAndWait("clickPayNow");
      return;
    }
    if (action === "pay_next") {
      await clickAndWait("clickNextStep");
      return;
    }
    if (action === "payer_ok") {
      await clickAndWait("clickOk");
      await logPaymentAndStop();
      return;
    }
    if (action === "done_pay") {
      await logPaymentAndStop();
      return;
    }
    if (action === "pay_later") {
      await clickAndWait("clickPayNow");
      return;
    }
    await clickAndWait("clickNext");
  }
  async function runLoop(fresh) {
    if (running) return;
    running = true;
    sessionStorage.setItem(RUN_KEY, "1");
    if (fresh) resetLog();
    else if (!sessionStorage.getItem(T0_KEY)) resetLog();
    setButtons(true);
    startClock();
    addLog("RUN", shortUrl(location.href));
    finishPendingNav();
    try {
      await injectBridge();
      const loaded = await loadApplicant();
      if (!loaded.applicant) {
        addLog("ERR", "Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u. M\u1EDF Options.");
        stopRun();
        return;
      }
      for (let i = 0; i < MAX_PAGES; i += 1) {
        if (sessionStorage.getItem(RUN_KEY) !== "1") break;
        await stepOnce(loaded.applicant, loaded.credentials || {});
        await sleep(80);
      }
    } catch (err) {
      addLog("ERR", String(err instanceof Error ? err.message : err));
      stopRun();
    } finally {
      running = false;
      setButtons(sessionStorage.getItem(RUN_KEY) === "1");
    }
  }
  function mountPanel() {
    const existing = document.getElementById("whs-panel");
    if (existing) {
      setPanel(existing);
      if (!existing.querySelector(".whs-clock")) {
        const head = existing.querySelector(".whs-head");
        const clock = document.createElement("span");
        clock.className = "whs-clock";
        head?.appendChild(clock);
      }
      return;
    }
    const next = document.createElement("div");
    next.id = "whs-panel";
    next.innerHTML = '<div class="whs-head"><span>NZ WHS Auto Fill</span><span class="whs-clock"></span></div><div class="whs-body"><div class="whs-status">B\u1EA5m Ch\u1EA1y. Log th\u1EDDi gian \u1EDF d\u01B0\u1EDBi.</div><pre class="whs-log">Ch\u01B0a c\xF3 log. B\u1EA5m Ch\u1EA1y.</pre><div class="whs-row"><button class="whs-run" type="button">Ch\u1EA1y</button><button class="whs-stop" type="button" disabled>D\u1EEBng</button><button class="whs-opts" type="button">D\u1EEF li\u1EC7u</button><button class="whs-copy" type="button">Copy log</button></div></div>';
    document.documentElement.appendChild(next);
    setPanel(next);
    next.querySelector(".whs-run")?.addEventListener("click", () => {
      void runLoop(true);
    });
    next.querySelector(".whs-stop")?.addEventListener("click", () => {
      stopRun();
    });
    next.querySelector(".whs-opts")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
    next.querySelector(".whs-copy")?.addEventListener("click", () => copyLog());
    renderLog();
  }
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "START") void runLoop(true);
    if (msg?.type === "STOP") {
      stopRun();
    }
  });
  mountPanel();
  if (isPaystationHost()) {
    void announcePaystationArrival();
  } else {
    startHighLoadWatch(stopRun);
    if (sessionStorage.getItem(RUN_KEY) === "1") {
      setStatus("Ti\u1EBFp t\u1EE5c sau khi chuy\u1EC3n trang...");
      startClock();
      setTimeout(() => {
        void runLoop();
      }, 100);
    }
  }
})();
