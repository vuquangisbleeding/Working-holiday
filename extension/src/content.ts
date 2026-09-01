import { DEFAULT_APPLICANT } from "./default-data";
import type { Applicant, Credentials } from "../../src/types";
import { callBridge, injectBridge } from "./content/bridge";
import { tickYesNow, waitCaptcha, waitNav } from "./content/captcha";
import { detectPage, recoverHighLoad, startHighLoadWatch } from "./content/detect";
import { fillPage } from "./content/fill";
import { addLog, copyLog, renderLog, resetLog, withStuck } from "./content/log";
import { clickAndWait, finishPendingNav } from "./content/nav";
import { LAST_PAGE_KEY, MAX_PAGES, panel, RUN_KEY, setActivity, setPanel, setStatus, shortUrl, sleep, T0_KEY } from "./content/state";

let running = false;

function setButtons(isRunning: boolean): void {
  if (!panel) return;
  const run = panel.querySelector(".whs-run") as HTMLButtonElement | null;
  const stop = panel.querySelector(".whs-stop") as HTMLButtonElement | null;
  if (run) run.disabled = isRunning;
  if (stop) stop.disabled = !isRunning;
}

function stopRun(): void {
  if (sessionStorage.getItem(RUN_KEY) === "1" && sessionStorage.getItem(T0_KEY)) {
    addLog("SUMMARY", "Tổng từ lúc Chạy: " + ((Date.now() - Number(sessionStorage.getItem(T0_KEY))) / 1000).toFixed(2) + "s");
  }
  sessionStorage.removeItem(RUN_KEY);
  running = false;
  setButtons(false);
}

async function loadApplicant(): Promise<{ applicant: Applicant; credentials: Credentials }> {
  const stored = await chrome.storage.local.get(["applicant", "credentials"]);
  return {
    applicant: (stored.applicant as Applicant | undefined) || DEFAULT_APPLICANT,
    credentials: (stored.credentials as Credentials) || {},
  };
}

async function stepOnce(data: Applicant, creds: Credentials): Promise<void> {
  await tickYesNow();
  await waitCaptcha(false, false);
  if (await recoverHighLoad(stopRun)) return;
  const page = detectPage();
  setActivity(page + " | " + shortUrl(location.href), "nhận diện trang");
  addLog("PAGE", page + " | " + shortUrl(location.href));
  sessionStorage.setItem(LAST_PAGE_KEY, page);
  if (page === "highload") {
    await recoverHighLoad(stopRun);
    return;
  }
  if (page === "quota") {
    addLog("ERR", "Scheme đã hết chỗ / đóng");
    stopRun();
    return;
  }
  if (page === "denied") {
    addLog(
      "ERR",
      "INZ Access denied — thường do SUBMIT/Next bị bấm 2 lần hoặc token trang đã dùng. Đừng F5. Đóng hết cửa sổ Chrome, login lại, mở Edit Incomplete.",
    );
    stopRun();
    return;
  }
  if (page === "login") {
    const user = document.querySelector('[name="username"]') as HTMLInputElement | null;
    const pass = document.querySelector('[name="password"]') as HTMLInputElement | null;
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
      addLog("ERR", "Thiếu username/password trong Options");
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
    const started = Date.now();
    addLog("COUNTRY", country);
    sessionStorage.setItem("whsPendingNav", JSON.stringify({ from: shortUrl(before), t: started, op: "COUNTRY" }));
    const r = await callBridge("clickCountry", { country });
    if (!r.ok) {
      sessionStorage.removeItem("whsPendingNav");
      addLog("ERR", "Không tìm thấy country " + country);
      stopRun();
      return;
    }
    await sleep(200);
    await waitCaptcha();
    await waitNav(before);
    finishPendingNav();
    return;
  }
  if (page === "captcha") {
    const clicked = await waitCaptcha();
    if (sessionStorage.getItem(RUN_KEY) !== "1") return;
    if (!clicked) await clickAndWait("clickNext");
    return;
  }

  const fillStart = Date.now();
  setActivity(page + " | " + shortUrl(location.href), "điền " + page);
  const action = await withStuck("điền " + page + " | " + shortUrl(location.href), () => fillPage(page, data));
  addLog("FILL", "xong " + page, Date.now() - fillStart);
  if (action === "stop" || action === "unknown") {
    addLog("STOP", action === "unknown" ? "Trang chưa hỗ trợ" : "Dừng");
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
    addLog("DONE", "Đã điền payer + OK. Trang thẻ là bước cuối — bot dừng.");
    stopRun();
    return;
  }
  if (action === "done_pay") {
    addLog("DONE", "Đã tới trang thanh toán thẻ — xong bot.");
    stopRun();
    return;
  }
  if (action === "pay_later") {
    await clickAndWait("clickPayNow");
    return;
  }
  await clickAndWait("clickNext");
}

async function runLoop(fresh?: boolean): Promise<void> {
  if (running) return;
  running = true;
  sessionStorage.setItem(RUN_KEY, "1");
  if (fresh) resetLog();
  else if (!sessionStorage.getItem(T0_KEY)) resetLog();
  setButtons(true);
  addLog("RUN", shortUrl(location.href));
  finishPendingNav();
  try {
    await injectBridge();
    const loaded = await loadApplicant();
    if (!loaded.applicant) {
      addLog("ERR", "Chưa có dữ liệu. Mở Options.");
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

function mountPanel(): void {
  const existing = document.getElementById("whs-panel");
  if (existing) {
    setPanel(existing);
    return;
  }
  const next = document.createElement("div");
  next.id = "whs-panel";
  next.innerHTML =
    '<div class="whs-head"><span>NZ WHS Auto Fill</span></div>' +
    '<div class="whs-body">' +
    '<div class="whs-status">Bấm Chạy. Log thời gian ở dưới.</div>' +
    '<pre class="whs-log">Chưa có log. Bấm Chạy.</pre>' +
    '<div class="whs-row">' +
    '<button class="whs-run" type="button">Chạy</button>' +
    '<button class="whs-stop" type="button" disabled>Dừng</button>' +
    '<button class="whs-opts" type="button">Dữ liệu</button>' +
    '<button class="whs-copy" type="button">Copy log</button>' +
    "</div></div>";
  document.documentElement.appendChild(next);
  setPanel(next);
  next.querySelector(".whs-run")?.addEventListener("click", () => {
    void runLoop(true);
  });
  next.querySelector(".whs-stop")?.addEventListener("click", () => {
    stopRun();
    setStatus("Đã dừng. Log vẫn giữ.");
  });
  next.querySelector(".whs-opts")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
  next.querySelector(".whs-copy")?.addEventListener("click", () => copyLog());
  renderLog();
}

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
  if (msg?.type === "START") void runLoop(true);
  if (msg?.type === "STOP") {
    stopRun();
    setStatus("Đã dừng.");
  }
});

mountPanel();
startHighLoadWatch(stopRun);
if (sessionStorage.getItem(RUN_KEY) === "1") {
  setStatus("Tiếp tục sau khi chuyển trang...");
  setTimeout(() => {
    void runLoop();
  }, 100);
}
