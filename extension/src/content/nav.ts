import { callBridge, waitPostback } from "./bridge";
import { tickYesNow, waitCaptcha, waitNav } from "./captcha";
import { addLog, withStuck } from "./log";
import { setActivity, shortUrl, sleep, wasClickedRecently, markClicked } from "./state";

export function finishPendingNav(): void {
  const raw = sessionStorage.getItem("whsPendingNav");
  if (!raw) return;
  try {
    const p = JSON.parse(raw) as { from?: string; t: number };
    addLog("NAV", (p.from || "") + " → " + shortUrl(location.href), Date.now() - p.t);
  } catch {
    // ignore
  }
  sessionStorage.removeItem("whsPendingNav");
}

function clickLabel(r: Record<string, unknown> | undefined, fallback: string): string {
  const clicked = r?.clicked ? String(r.clicked) : fallback;
  const id = r?.id ? String(r.id).split("_").pop() : "";
  const value = r?.value ? String(r.value) : "";
  return clicked + (value ? ' "' + value + '"' : "") + (id ? " #" + id : "");
}

async function clickSubmitFallback(): Promise<Record<string, unknown> | undefined> {
  addLog("CLICK", "Không có Next trên " + shortUrl(location.href) + " — bấm SUBMIT");
  setActivity(shortUrl(location.href), "bấm SUBMIT");
  await tickYesNow();
  const clicked = await waitCaptcha(true);
  if (clicked) return { ok: true, clicked: "SUBMIT" };
  if (wasClickedRecently("clickSubmit")) return { ok: true, skipped: true };
  const sub = await callBridge("clickSubmit");
  if (sub?.ok) markClicked("clickSubmit");
  return sub;
}

async function advanceWithoutNext(before: string): Promise<Record<string, unknown> | undefined> {
  const canSubmit = await callBridge("hasSubmit");
  if (canSubmit?.ok) return clickSubmitFallback();

  addLog("CLICK", "Không có Next trên " + shortUrl(before) + " — tìm SAVE");
  const save = await callBridge("clickSave");
  if (!save?.ok) return clickSubmitFallback();

  addLog("CLICK", "Đã bấm " + clickLabel(save, "SAVE") + " vì không có Next");
  await waitPostback();
  await waitCaptcha();
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (location.href !== before) {
      addLog("NAV", "SAVE đã chuyển trang → " + shortUrl(location.href));
      return save;
    }
    const again = await callBridge("hasNext");
    if (again?.ok) {
      const next = await callBridge("clickNext");
      if (next?.ok) {
        addLog("CLICK", "Bấm " + clickLabel(next, "NEXT") + " sau SAVE");
        return next;
      }
    }
    await sleep(250);
  }
  addLog("CLICK", "SAVE xong, chưa thấy Next trên " + shortUrl(location.href));
  return save;
}

export async function clickAndWait(op: string, payload?: unknown): Promise<Record<string, unknown> | undefined> {
  const before = location.href;
  const started = Date.now();
  const label = op.replace(/^click/i, "").toUpperCase();
  setActivity(shortUrl(before), "bấm " + label);
  if (wasClickedRecently(op)) {
    addLog("CLICK", "Chờ trang sau " + label + " (đã bấm trên " + shortUrl(before) + ")");
    await waitNav(before);
    finishPendingNav();
    return { ok: true, skipped: true };
  }
  addLog("CLICK", "Tìm " + label + " trên " + shortUrl(before));
  sessionStorage.setItem(
    "whsPendingNav",
    JSON.stringify({ from: shortUrl(before), t: started, op: label }),
  );
  let r = await withStuck("bấm " + label + " | " + shortUrl(before), () => callBridge(op, payload));

  if (op === "clickNext" && (!r || !r.ok)) r = await advanceWithoutNext(before);

  if (r?.clicked === "SAVE" && location.href === before) {
    markClicked(op);
    finishPendingNav();
    return r;
  }

  if (!r || !r.ok) {
    sessionStorage.removeItem("whsPendingNav");
    addLog("ERR", "Không bấm được " + label + " trên " + shortUrl(location.href), Date.now() - started);
    return r;
  }
  markClicked(op);
  addLog("CLICK", "Đã bấm " + clickLabel(r, label) + " trên " + shortUrl(before));
  const clickAgain = op !== "clickSubmit" && op !== "clickPayNow" && op !== "clickPayLater" && op !== "clickOk";
  await waitCaptcha(false, clickAgain);
  const navTimeout = op === "clickOk" || op === "clickPayNow" || op === "clickNextStep" ? 45000 : 20000;
  await waitNav(before, navTimeout);
  finishPendingNav();
  return r;
}
