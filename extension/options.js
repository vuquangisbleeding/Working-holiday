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

  // src/telegram/identity.ts
  function applicantIdentityLines(data) {
    const p = data?.personal;
    const name = [p?.family_name, p?.given_name_1, p?.given_name_2, p?.given_name_3].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
    const email = String(data?.contact?.email || "").trim();
    return [name ? "H\u1ECD t\xEAn: " + name : "", email ? "Email: " + email : ""].filter(Boolean);
  }

  // extension/src/options.ts
  async function load() {
    const stored = await chrome.storage.local.get(["applicant", "credentials", "telegram"]);
    const data = stored.applicant || DEFAULT_APPLICANT;
    const json = document.getElementById("json");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const tgEnabled = document.getElementById("tgEnabled");
    const tgToken = document.getElementById("tgToken");
    const tgChat = document.getElementById("tgChat");
    const tg = stored.telegram || {};
    json.value = JSON.stringify(data, null, 2);
    username.value = stored.credentials?.username || "";
    password.value = stored.credentials?.password || "";
    tgEnabled.checked = !!tg.enabled;
    tgToken.value = tg.botToken || "";
    tgChat.value = tg.chatId || "";
  }
  async function saveTelegram() {
    const tgEnabled = document.getElementById("tgEnabled");
    const tgToken = document.getElementById("tgToken");
    const tgChat = document.getElementById("tgChat");
    const telegram = {
      enabled: tgEnabled.checked,
      botToken: tgToken.value.replace(/\s+/g, ""),
      chatId: tgChat.value.trim()
    };
    await chrome.storage.local.set({ telegram });
    return telegram;
  }
  async function saveAll() {
    const msg = document.getElementById("msg");
    try {
      const json = document.getElementById("json");
      const username = document.getElementById("username");
      const password = document.getElementById("password");
      const applicant = JSON.parse(json.value);
      const credentials = {
        username: username.value.trim(),
        password: password.value
      };
      await saveTelegram();
      await chrome.storage.local.set({ applicant, credentials });
      msg.textContent = "\u0110\xE3 l\u01B0u.";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      msg.textContent = "JSON l\u1ED7i: " + message;
    }
  }
  document.getElementById("save")?.addEventListener("click", () => {
    void saveAll();
  });
  document.getElementById("restore")?.addEventListener("click", () => {
    const json = document.getElementById("json");
    const msg = document.getElementById("msg");
    json.value = JSON.stringify(DEFAULT_APPLICANT, null, 2);
    msg.textContent = "\u0110\xE3 \u0111\u01B0a m\u1EB7c \u0111\u1ECBnh l\xEAn form. B\u1EA5m L\u01B0u \u0111\u1EC3 ghi.";
  });
  document.getElementById("tgChatId")?.addEventListener("click", async () => {
    const msg = document.getElementById("msg");
    const tgChat = document.getElementById("tgChat");
    const tgToken = document.getElementById("tgToken");
    msg.textContent = "\u0110ang l\u1EA5y Chat ID...";
    const telegram = await saveTelegram();
    const result = await chrome.runtime.sendMessage({
      type: "TELEGRAM_CHAT_ID",
      token: telegram.botToken || tgToken.value.replace(/\s+/g, "")
    });
    if (chrome.runtime.lastError) {
      msg.textContent = chrome.runtime.lastError.message || "L\u1ED7i extension. Reload unpacked r\u1ED3i th\u1EED l\u1EA1i.";
      return;
    }
    if (!result?.ok || !result.chatId) {
      msg.textContent = result?.error || "Ch\u01B0a l\u1EA5y \u0111\u01B0\u1EE3c Chat ID.";
      return;
    }
    tgChat.value = result.chatId;
    const tgEnabled = document.getElementById("tgEnabled");
    tgEnabled.checked = true;
    await saveTelegram();
    msg.textContent = (result.bot ? result.bot + " \u2014 " : "") + "Chat ID: " + result.chatId + (result.chats && result.chats.length > 1 ? " (" + result.chats.map((c) => c.label).join("; ") + ")" : "");
  });
  document.getElementById("tgTest")?.addEventListener("click", async () => {
    const msg = document.getElementById("msg");
    const telegram = await saveTelegram();
    if (!telegram.botToken || !telegram.chatId) {
      msg.textContent = "D\xE1n token, b\u1EA5m L\u1EA5y Chat ID, r\u1ED3i G\u1EEDi th\u1EED.";
      return;
    }
    const stored = await chrome.storage.local.get(["applicant"]);
    const identity = applicantIdentityLines(stored.applicant || DEFAULT_APPLICANT);
    const result = await chrome.runtime.sendMessage({
      type: "TELEGRAM",
      text: ["NZ WHS test", ...identity, "N\u1EBFu th\u1EA5y tin n\xE0y th\xEC c\u1EA5u h\xECnh Telegram \u1ED5n."].join("\n"),
      token: telegram.botToken,
      chatId: telegram.chatId
    });
    if (chrome.runtime.lastError) {
      msg.textContent = chrome.runtime.lastError.message || "L\u1ED7i extension.";
      return;
    }
    msg.textContent = result?.ok ? "Telegram: \u0111\xE3 g\u1EEDi tin th\u1EED." : "Telegram l\u1ED7i: " + (result?.error || "kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c");
  });
  void load();
})();
