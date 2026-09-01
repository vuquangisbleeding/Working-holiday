import type { Applicant } from "../../../src/types";
import { applicantIdentityLines } from "../../../src/telegram/identity";
import { addLog } from "./log";

export async function notifyTelegram(payUrl: string, timing: string): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(["telegram", "whsTelegramSent", "applicant"]);
    const tg = stored.telegram as { enabled?: boolean; botToken?: string; chatId?: string } | undefined;
    if (stored.whsTelegramSent) return;
    if (!tg?.enabled) return;
    if (!tg.botToken || !tg.chatId) {
      addLog("TELEGRAM", "Thiếu bot token hoặc Chat ID trong Options");
      return;
    }
    const text = [
      "NZ WHS xong",
      ...applicantIdentityLines(stored.applicant as Applicant | undefined),
      timing,
      payUrl || "(chưa có link Paystation)",
    ]
      .filter(Boolean)
      .join("\n");
    const result = (await chrome.runtime.sendMessage({ type: "TELEGRAM", text })) as { ok?: boolean; error?: string } | undefined;
    if (result?.ok) {
      await chrome.storage.local.set({ whsTelegramSent: true });
      addLog("TELEGRAM", "Đã gửi Telegram");
      return;
    }
    addLog("TELEGRAM", "Không gửi được: " + (result?.error || "không rõ"));
  } catch (err) {
    addLog("TELEGRAM", String(err instanceof Error ? err.message : err));
  }
}
