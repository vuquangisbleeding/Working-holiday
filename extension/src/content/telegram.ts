import type { Applicant } from "../../../src/types";
import { applicantIdentityLines } from "../../../src/telegram/identity";
import { addLog, logText } from "./log";

type TelegramConfig = { enabled?: boolean; botToken?: string; chatId?: string };

async function sendTelegram(text: string): Promise<boolean> {
  const result = (await chrome.runtime.sendMessage({ type: "TELEGRAM", text })) as { ok?: boolean; error?: string } | undefined;
  if (result?.ok) return true;
  addLog("TELEGRAM", "Không gửi được: " + (result?.error || "không rõ"));
  return false;
}

function hasTelegramConfig(tg: TelegramConfig | undefined): boolean {
  if (!tg?.enabled) return false;
  if (tg.botToken && tg.chatId) return true;
  addLog("TELEGRAM", "Thiếu bot token hoặc Chat ID trong Options");
  return false;
}

export async function notifyTelegramLog(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(["telegram", "whsLogSent", "applicant"]);
    if (stored.whsLogSent || !hasTelegramConfig(stored.telegram as TelegramConfig | undefined)) return;
    const header = [
      "NZ WHS log trước payment",
      ...applicantIdentityLines(stored.applicant as Applicant | undefined),
    ]
      .filter(Boolean)
      .join("\n")
    const fullLog = logText();
    const maxLogLength = Math.max(0, 3900 - header.length - 2);
    const text = header + "\n" + (fullLog.length > maxLogLength ? "...\n" + fullLog.slice(-maxLogLength + 4) : fullLog);
    if (await sendTelegram(text)) {
      await chrome.storage.local.set({ whsLogSent: true });
      addLog("TELEGRAM", "Đã gửi log trước payment");
    }
  } catch (err) {
    addLog("TELEGRAM", String(err instanceof Error ? err.message : err));
  }
}

export async function notifyTelegram(payUrl: string, timing: string): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(["telegram", "whsTelegramSent", "applicant"]);
    const tg = stored.telegram as TelegramConfig | undefined;
    if (stored.whsTelegramSent) return;
    if (!hasTelegramConfig(tg)) return;
    const text = [
      "NZ WHS xong",
      ...applicantIdentityLines(stored.applicant as Applicant | undefined),
      timing,
      payUrl || "(chưa có link Paystation)",
    ]
      .filter(Boolean)
      .join("\n");
    if (await sendTelegram(text)) {
      await chrome.storage.local.set({ whsTelegramSent: true });
      addLog("TELEGRAM", "Đã gửi Telegram");
    }
  } catch (err) {
    addLog("TELEGRAM", String(err instanceof Error ? err.message : err));
  }
}
