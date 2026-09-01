import { DEFAULT_APPLICANT } from "./default-data";
import type { TelegramSettings } from "../../src/types";

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["applicant"]);
  if (!cur.applicant) {
    await chrome.storage.local.set({ applicant: DEFAULT_APPLICANT });
  }
});

chrome.runtime.onMessage.addListener(
  (msg: { type?: string; text?: string; token?: string; chatId?: string }, _sender, sendResponse) => {
    if (msg?.type !== "TELEGRAM" && msg?.type !== "TELEGRAM_CHAT_ID" && msg?.type !== "TELEGRAM_LOCAL") return false;
    void (async () => {
      try {
        if (msg.type === "TELEGRAM_LOCAL") {
          const post = await fetch("http://127.0.0.1:5050/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: String(msg.text || "") }),
          });
          const raw = await post.text();
          let data: { ok?: boolean; error?: string } = {};
          try {
            data = JSON.parse(raw) as { ok?: boolean; error?: string };
          } catch {
            sendResponse({ ok: false, error: "Dashboard không trả JSON (đã chạy npm start chưa?)" });
            return;
          }
          sendResponse({ ok: !!data.ok, error: data.ok ? undefined : data.error || "Telegram local HTTP " + post.status });
          return;
        }
        const stored = await chrome.storage.local.get(["telegram"]);
        const tg = stored.telegram as TelegramSettings | undefined;
        const token = String(msg.token || tg?.botToken || "").replace(/\s+/g, "");
        const chatId = String(msg.chatId || tg?.chatId || "").trim();
        if (!token) {
          sendResponse({ ok: false, error: "Dán bot token vào ô rồi bấm lại." });
          return;
        }
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
          sendResponse({ ok: false, error: "Token sai format. Copy nguyên từ BotFather (có dấu : ở giữa)." });
          return;
        }
        const api = (method: string, query = "") =>
          fetch("https://api.telegram.org/bot" + token + "/" + method + query);

        if (msg.type === "TELEGRAM_CHAT_ID") {
          const meRes = await api("getMe");
          const me = (await meRes.json()) as { ok?: boolean; description?: string; result?: { username?: string } };
          if (!me.ok) {
            sendResponse({
              ok: false,
              error: "Token không dùng được: " + (me.description || meRes.status) + ". Lấy token mới từ BotFather (/revoke hoặc /token).",
            });
            return;
          }
          await api("deleteWebhook?drop_pending_updates=false");
          const res = await api("getUpdates?limit=100");
          const data = (await res.json()) as {
            ok?: boolean;
            description?: string;
            result?: Array<Record<string, unknown>>;
          };
          if (!data.ok) {
            const conflict = /conflict|409/i.test(data.description || "") || res.status === 409;
            sendResponse({
              ok: false,
              error: conflict
                ? "Bot đang polling (npm start). Đừng bấm Lấy Chat ID — mở Telegram gửi /start, Chat ID tự lưu."
                : data.description || "getUpdates thất bại",
            });
            return;
          }
          const ids: Array<{ id: string; label: string }> = [];
          const seen = new Set<string>();
          const pushChat = (chat: unknown) => {
            if (!chat || typeof chat !== "object") return;
            const c = chat as { id?: number; type?: string; first_name?: string; username?: string; title?: string };
            if (c.id == null) return;
            const id = String(c.id);
            if (seen.has(id)) return;
            seen.add(id);
            const who = c.first_name || c.title || c.username || c.type || "chat";
            ids.push({ id, label: who + " → " + id });
          };
          for (const u of data.result || []) {
            const row = u as {
              message?: { chat?: unknown };
              edited_message?: { chat?: unknown };
              my_chat_member?: { chat?: unknown };
              chat_member?: { chat?: unknown };
              channel_post?: { chat?: unknown };
              callback_query?: { message?: { chat?: unknown }; from?: { id?: number } };
            };
            pushChat(row.message?.chat);
            pushChat(row.edited_message?.chat);
            pushChat(row.my_chat_member?.chat);
            pushChat(row.chat_member?.chat);
            pushChat(row.channel_post?.chat);
            pushChat(row.callback_query?.message?.chat);
            if (row.callback_query?.from?.id != null) pushChat({ id: row.callback_query.from.id, type: "private" });
          }
          const botName = me.result?.username ? "@" + me.result.username : "bot";
          if (!ids.length) {
            sendResponse({
              ok: false,
              error:
                "Token ổn (" +
                botName +
                ") nhưng chưa có tin. Mở Telegram → tìm đúng " +
                botName +
                " → Start → gửi hi → quay lại bấm Lấy Chat ID.",
            });
            return;
          }
          sendResponse({ ok: true, chatId: ids[ids.length - 1].id, chats: ids, bot: botName });
          return;
        }
        if (!chatId) {
          sendResponse({ ok: false, error: "Chưa có Chat ID. Bấm Lấy Chat ID trước." });
          return;
        }
        const post = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: String(msg.text || "").slice(0, 3900),
            disable_web_page_preview: false,
          }),
        });
        const data = (await post.json()) as { ok?: boolean; description?: string };
        sendResponse({ ok: !!data.ok, error: data.ok ? undefined : data.description || "Telegram HTTP " + post.status });
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  },
);
