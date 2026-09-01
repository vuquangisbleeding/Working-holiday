import { DEFAULT_APPLICANT } from "./default-data";
import type { TelegramSettings } from "../../src/types";
import { applicantIdentityLines } from "../../src/telegram/identity";

async function load(): Promise<void> {
  const stored = await chrome.storage.local.get(["applicant", "credentials", "telegram"]);
  const data = stored.applicant || DEFAULT_APPLICANT;
  const json = document.getElementById("json") as HTMLTextAreaElement;
  const username = document.getElementById("username") as HTMLInputElement;
  const password = document.getElementById("password") as HTMLInputElement;
  const tgEnabled = document.getElementById("tgEnabled") as HTMLInputElement;
  const tgToken = document.getElementById("tgToken") as HTMLInputElement;
  const tgChat = document.getElementById("tgChat") as HTMLInputElement;
  const tg = (stored.telegram || {}) as TelegramSettings;
  json.value = JSON.stringify(data, null, 2);
  username.value = stored.credentials?.username || "";
  password.value = stored.credentials?.password || "";
  tgEnabled.checked = !!tg.enabled;
  tgToken.value = tg.botToken || "";
  tgChat.value = tg.chatId || "";
}

async function saveTelegram(): Promise<TelegramSettings> {
  const tgEnabled = document.getElementById("tgEnabled") as HTMLInputElement;
  const tgToken = document.getElementById("tgToken") as HTMLInputElement;
  const tgChat = document.getElementById("tgChat") as HTMLInputElement;
  const telegram: TelegramSettings = {
    enabled: tgEnabled.checked,
    botToken: tgToken.value.replace(/\s+/g, ""),
    chatId: tgChat.value.trim(),
  };
  await chrome.storage.local.set({ telegram });
  return telegram;
}

async function saveAll(): Promise<void> {
  const msg = document.getElementById("msg") as HTMLElement;
  try {
    const json = document.getElementById("json") as HTMLTextAreaElement;
    const username = document.getElementById("username") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const applicant = JSON.parse(json.value);
    const credentials = {
      username: username.value.trim(),
      password: password.value,
    };
    await saveTelegram();
    await chrome.storage.local.set({ applicant, credentials });
    msg.textContent = "Đã lưu.";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    msg.textContent = "JSON lỗi: " + message;
  }
}

document.getElementById("save")?.addEventListener("click", () => {
  void saveAll();
});

document.getElementById("restore")?.addEventListener("click", () => {
  const json = document.getElementById("json") as HTMLTextAreaElement;
  const msg = document.getElementById("msg") as HTMLElement;
  json.value = JSON.stringify(DEFAULT_APPLICANT, null, 2);
  msg.textContent = "Đã đưa mặc định lên form. Bấm Lưu để ghi.";
});

document.getElementById("tgChatId")?.addEventListener("click", async () => {
  const msg = document.getElementById("msg") as HTMLElement;
  const tgChat = document.getElementById("tgChat") as HTMLInputElement;
  const tgToken = document.getElementById("tgToken") as HTMLInputElement;
  msg.textContent = "Đang lấy Chat ID...";
  const telegram = await saveTelegram();
  const result = (await chrome.runtime.sendMessage({
    type: "TELEGRAM_CHAT_ID",
    token: telegram.botToken || tgToken.value.replace(/\s+/g, ""),
  })) as {
    ok?: boolean;
    error?: string;
    chatId?: string;
    chats?: Array<{ id: string; label: string }>;
    bot?: string;
  };
  if (chrome.runtime.lastError) {
    msg.textContent = chrome.runtime.lastError.message || "Lỗi extension. Reload unpacked rồi thử lại.";
    return;
  }
  if (!result?.ok || !result.chatId) {
    msg.textContent = result?.error || "Chưa lấy được Chat ID.";
    return;
  }
  tgChat.value = result.chatId;
  const tgEnabled = document.getElementById("tgEnabled") as HTMLInputElement;
  tgEnabled.checked = true;
  await saveTelegram();
  msg.textContent =
    (result.bot ? result.bot + " — " : "") +
    "Chat ID: " +
    result.chatId +
    (result.chats && result.chats.length > 1 ? " (" + result.chats.map((c) => c.label).join("; ") + ")" : "");
});

document.getElementById("tgTest")?.addEventListener("click", async () => {
  const msg = document.getElementById("msg") as HTMLElement;
  const telegram = await saveTelegram();
  if (!telegram.botToken || !telegram.chatId) {
    msg.textContent = "Dán token, bấm Lấy Chat ID, rồi Gửi thử.";
    return;
  }
  const stored = await chrome.storage.local.get(["applicant"]);
  const identity = applicantIdentityLines(stored.applicant || DEFAULT_APPLICANT);
  const result = (await chrome.runtime.sendMessage({
    type: "TELEGRAM",
    text: ["NZ WHS test", ...identity, "Nếu thấy tin này thì cấu hình Telegram ổn."].join("\n"),
    token: telegram.botToken,
    chatId: telegram.chatId,
  })) as { ok?: boolean; error?: string };
  if (chrome.runtime.lastError) {
    msg.textContent = chrome.runtime.lastError.message || "Lỗi extension.";
    return;
  }
  msg.textContent = result?.ok ? "Telegram: đã gửi tin thử." : "Telegram lỗi: " + (result?.error || "không gửi được");
});

void load();
