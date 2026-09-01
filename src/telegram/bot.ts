import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { config } from "dotenv";

type TgMessage = { chat: { id: number }; text?: string };
type TgBot = {
  onText: (re: RegExp, cb: (msg: TgMessage) => void) => void;
  on: {
    (event: "message", cb: (msg: TgMessage) => void): void;
    (event: "polling_error", cb: (err: Error) => void): void;
  };
  sendMessage: (
    chatId: string | number,
    text: string,
    options?: { disable_web_page_preview?: boolean },
  ) => Promise<unknown>;
};
type TgBotCtor = new (token: string, options?: { polling?: boolean }) => TgBot;

const require = createRequire(import.meta.url);
const TelegramBot = require("node-telegram-bot-api") as TgBotCtor;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: path.join(ROOT, ".env") });

const CHAT_FILE = path.join(ROOT, ".telegram.json");

type ChatStore = { chatId?: string | number };

let bot: TgBot | null = null;

function readChatId(): string {
  try {
    if (!fs.existsSync(CHAT_FILE)) return "";
    const data = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8")) as ChatStore;
    return data.chatId != null ? String(data.chatId) : "";
  } catch {
    return "";
  }
}

function writeChatId(chatId: string | number): void {
  fs.writeFileSync(CHAT_FILE, JSON.stringify({ chatId: String(chatId) }, null, 2) + "\n", "utf8");
}

export function savedChatId(): string {
  return readChatId();
}

export async function sendTelegramText(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").replace(/\s+/g, "");
  const chatId = readChatId();
  if (!token) return { ok: false, error: "Thiếu TELEGRAM_BOT_TOKEN trong .env" };
  if (!chatId) return { ok: false, error: "Chưa có Chat ID. Mở Telegram, gửi /start cho bot đang chạy." };
  try {
    const sender = bot ?? new TelegramBot(token, { polling: false });
    await sender.sendMessage(chatId, text.slice(0, 3900), { disable_web_page_preview: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function startTelegramBot(): TgBot | null {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || "").replace(/\s+/g, "");
  if (!token) {
    console.log("Telegram: bỏ qua (không có TELEGRAM_BOT_TOKEN trong .env)");
    return null;
  }
  if (bot) return bot;
  bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    writeChatId(chatId);
    void bot?.sendMessage(
      chatId,
      "Received your message\n\nĐã lưu Chat ID: " +
        chatId +
        "\nKhi tool tới trang thanh toán, bot sẽ gửi tổng thời gian + link Paystation vào đây.",
    );
    console.log("Telegram /start — Chat ID", chatId);
  });

  bot.onText(/\/id/, (msg) => {
    void bot?.sendMessage(msg.chat.id, "Chat ID: " + msg.chat.id);
  });

  bot.on("message", (msg) => {
    if (!msg.chat?.id) return;
    writeChatId(msg.chat.id);
    if (msg.text && !msg.text.startsWith("/")) {
      void bot?.sendMessage(msg.chat.id, "Received your message\nChat ID: " + msg.chat.id);
    }
  });

  bot.on("polling_error", (err) => {
    console.error("Telegram polling:", err.message);
  });

  const existing = readChatId();
  console.log(
    "Telegram bot is running. Mở Telegram, gửi /start." +
      (existing ? " Chat ID đã có: " + existing : " Chưa có Chat ID."),
  );
  return bot;
}

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  startTelegramBot();
  if (!process.env.TELEGRAM_BOT_TOKEN) process.exit(1);
}
