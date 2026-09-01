import { callBridge, waitPostback } from "./bridge";
import { tickYesNow, waitCaptcha, waitNav } from "./captcha";
import { addLog, withStuck } from "./log";
import { setActivity, shortUrl, sleep } from "./state";

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
  addLog("CLICK", "Không có Next/SAVE trên " + shortUrl(location.href) + " — bấm SUBMIT");
  setActivity(shortUrl(location.href), "bấm SUBMIT");
  await tickYesNow();
  await waitCaptcha(true);
  const sub = await callBridge("clickSubmit");
  if (sub?.ok) addLog("CLICK", "Đã bấm " + clickLabel(sub, "SUBMIT") + " trên " + shortUrl(location.href));
  return sub;
}

async function advanceWithoutNext(before: string): Promise<Record<string, unknown> | undefined> {
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
  addLog("CLICK", "Tìm " + label + " trên " + shortUrl(before));
  sessionStorage.setItem(
    "whsPendingNav",
    JSON.stringify({ from: shortUrl(before), t: started, op: label }),
  );
  let r = await withStuck("bấm " + label + " | " + shortUrl(before), () => callBridge(op, payload));

  if (op === "clickNext" && (!r || !r.ok)) r = await advanceWithoutNext(before);

  if (r?.clicked === "SAVE" && location.href === before) {
    finishPendingNav();
    return r;
  }

  if (!r || !r.ok) {
    sessionStorage.removeItem("whsPendingNav");
    addLog("ERR", "Không bấm được " + label + " trên " + shortUrl(location.href), Date.now() - started);
    return r;
  }
  addLog("CLICK", "Đã bấm " + clickLabel(r, label) + " trên " + shortUrl(before));
  await waitCaptcha();
  await waitNav(before);
  finishPendingNav();
  return r;
}
