"use strict";
(() => {
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

  // extension/src/background.ts
  chrome.runtime.onInstalled.addListener(async () => {
    const cur = await chrome.storage.local.get(["applicant"]);
    if (!cur.applicant) {
      await chrome.storage.local.set({ applicant: DEFAULT_APPLICANT });
    }
  });
  chrome.runtime.onMessage.addListener(
    (msg, _sender, sendResponse) => {
      if (msg?.type !== "TELEGRAM" && msg?.type !== "TELEGRAM_CHAT_ID" && msg?.type !== "TELEGRAM_LOCAL") return false;
      void (async () => {
        try {
          if (msg.type === "TELEGRAM_LOCAL") {
            const post2 = await fetch("http://127.0.0.1:5050/api/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: String(msg.text || "") })
            });
            const raw = await post2.text();
            let data2 = {};
            try {
              data2 = JSON.parse(raw);
            } catch {
              sendResponse({ ok: false, error: "Dashboard kh\xF4ng tr\u1EA3 JSON (\u0111\xE3 ch\u1EA1y npm start ch\u01B0a?)" });
              return;
            }
            sendResponse({ ok: !!data2.ok, error: data2.ok ? void 0 : data2.error || "Telegram local HTTP " + post2.status });
            return;
          }
          const stored = await chrome.storage.local.get(["telegram"]);
          const tg = stored.telegram;
          const token = String(msg.token || tg?.botToken || "").replace(/\s+/g, "");
          const chatId = String(msg.chatId || tg?.chatId || "").trim();
          if (!token) {
            sendResponse({ ok: false, error: "D\xE1n bot token v\xE0o \xF4 r\u1ED3i b\u1EA5m l\u1EA1i." });
            return;
          }
          if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
            sendResponse({ ok: false, error: "Token sai format. Copy nguy\xEAn t\u1EEB BotFather (c\xF3 d\u1EA5u : \u1EDF gi\u1EEFa)." });
            return;
          }
          const api = (method, query = "") => fetch("https://api.telegram.org/bot" + token + "/" + method + query);
          if (msg.type === "TELEGRAM_CHAT_ID") {
            const meRes = await api("getMe");
            const me = await meRes.json();
            if (!me.ok) {
              sendResponse({
                ok: false,
                error: "Token kh\xF4ng d\xF9ng \u0111\u01B0\u1EE3c: " + (me.description || meRes.status) + ". L\u1EA5y token m\u1EDBi t\u1EEB BotFather (/revoke ho\u1EB7c /token)."
              });
              return;
            }
            await api("deleteWebhook?drop_pending_updates=false");
            const res = await api("getUpdates?limit=100");
            const data2 = await res.json();
            if (!data2.ok) {
              const conflict = /conflict|409/i.test(data2.description || "") || res.status === 409;
              sendResponse({
                ok: false,
                error: conflict ? "Bot \u0111ang polling (npm start). \u0110\u1EEBng b\u1EA5m L\u1EA5y Chat ID \u2014 m\u1EDF Telegram g\u1EEDi /start, Chat ID t\u1EF1 l\u01B0u." : data2.description || "getUpdates th\u1EA5t b\u1EA1i"
              });
              return;
            }
            const ids = [];
            const seen = /* @__PURE__ */ new Set();
            const pushChat = (chat) => {
              if (!chat || typeof chat !== "object") return;
              const c = chat;
              if (c.id == null) return;
              const id = String(c.id);
              if (seen.has(id)) return;
              seen.add(id);
              const who = c.first_name || c.title || c.username || c.type || "chat";
              ids.push({ id, label: who + " \u2192 " + id });
            };
            for (const u of data2.result || []) {
              const row = u;
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
                error: "Token \u1ED5n (" + botName + ") nh\u01B0ng ch\u01B0a c\xF3 tin. M\u1EDF Telegram \u2192 t\xECm \u0111\xFAng " + botName + " \u2192 Start \u2192 g\u1EEDi hi \u2192 quay l\u1EA1i b\u1EA5m L\u1EA5y Chat ID."
              });
              return;
            }
            sendResponse({ ok: true, chatId: ids[ids.length - 1].id, chats: ids, bot: botName });
            return;
          }
          if (!chatId) {
            sendResponse({ ok: false, error: "Ch\u01B0a c\xF3 Chat ID. B\u1EA5m L\u1EA5y Chat ID tr\u01B0\u1EDBc." });
            return;
          }
          const post = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: String(msg.text || "").slice(0, 3900),
              disable_web_page_preview: false
            })
          });
          const data = await post.json();
          sendResponse({ ok: !!data.ok, error: data.ok ? void 0 : data.description || "Telegram HTTP " + post.status });
        } catch (err) {
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return true;
    }
  );
})();
