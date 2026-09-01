"use strict";
(() => {
  // src/types.ts
  var DEFAULT_WHS = {
    previous_whs_visa: "No",
    sufficient_funds_holiday: "Yes",
    travel_date: "20 November, 2026",
    been_to_nz: "No",
    been_to_nz_when: "",
    sufficient_funds_onward_ticket: "Yes",
    meet_scheme_requirements: "Yes"
  };

  // src/dashboard/ui.ts
  var LABELS = {
    scheme_country: "N\u01B0\u1EDBc scheme",
    personal: "C\xE1 nh\xE2n",
    address: "\u0110\u1ECBa ch\u1EC9",
    contact: "Li\xEAn h\u1EC7",
    identification: "H\u1ED9 chi\u1EBFu / ID",
    health: "S\u1EE9c kh\u1ECFe",
    character: "Character",
    occupation: "Ngh\u1EC1 nghi\u1EC7p",
    family_name: "H\u1ECD",
    given_name_1: "T\xEAn 1",
    given_name_2: "T\xEAn 2",
    given_name_3: "T\xEAn 3",
    other_names: "T\xEAn kh\xE1c",
    title: "Danh x\u01B0ng",
    other_title: "Danh x\u01B0ng kh\xE1c",
    gender: "Gi\u1EDBi t\xEDnh",
    date_of_birth: "Ng\xE0y sinh",
    country_of_birth: "N\u01B0\u1EDBc sinh",
    street_number: "S\u1ED1 nh\xE0",
    street_name: "T\xEAn \u0111\u01B0\u1EDDng",
    suburb: "Suburb",
    city: "Th\xE0nh ph\u1ED1",
    province: "T\u1EC9nh / bang",
    postal_code: "M\xE3 b\u01B0u \u0111i\u1EC7n",
    country: "Qu\u1ED1c gia",
    phone_daytime: "\u0110T ban ng\xE0y",
    phone_night: "\u0110T ban \u0111\xEAm",
    phone_mobile: "\u0110T di \u0111\u1ED9ng",
    fax: "Fax",
    email: "Email",
    has_agent: "C\xF3 lu\u1EADt s\u01B0 di tr\xFA?",
    communication_method: "C\xE1ch li\xEAn l\u1EA1c",
    has_credit_card: "C\xF3 Visa/Mastercard?",
    passport_number: "S\u1ED1 h\u1ED9 chi\u1EBFu",
    passport_expiry: "H\u1ED9 chi\u1EBFu h\u1EBFt h\u1EA1n",
    id_type: "Lo\u1EA1i gi\u1EA5y t\u1EDD",
    id_issue_date: "Ng\xE0y c\u1EA5p ID",
    id_expiry_date: "Ng\xE0y h\u1EBFt h\u1EA1n ID",
    renal_dialysis: "Ch\u1EA1y th\u1EADn",
    active_tb: "Lao \u0111ang ho\u1EA1t \u0111\u1ED9ng",
    cancer: "Ung th\u01B0",
    heart_disease: "Tim m\u1EA1ch",
    disability: "Khuy\u1EBFt t\u1EADt",
    hospitalisation: "Nh\u1EADp vi\u1EC7n",
    residential_care: "Ch\u0103m s\xF3c d\xE0i h\u1EA1n",
    pregnancy: "Mang thai",
    tb_risk: "Nguy c\u01A1 TB (3 th\xE1ng)",
    medical_details: "Chi ti\u1EBFt y t\u1EBF",
    imprisonment_5_years: "T\xF9 5 n\u0103m+",
    imprisonment_12_months: "T\xF9 12 th\xE1ng+",
    deported: "B\u1ECB tr\u1EE5c xu\u1EA5t",
    charged: "B\u1ECB bu\u1ED9c t\u1ED9i",
    convicted: "B\u1ECB k\u1EBFt \xE1n",
    under_investigation: "\u0110ang \u0111i\u1EC1u tra",
    excluded: "B\u1ECB t\u1EEB ch\u1ED1i nh\u1EADp c\u1EA3nh",
    removed: "B\u1ECB y\xEAu c\u1EA7u r\u1EDDi n\u01B0\u1EDBc",
    details: "Chi ti\u1EBFt",
    industry_search: "Ng\xE0nh (search)",
    occupation_search: "Ngh\u1EC1 (search)",
    whs: "Working Holiday",
    previous_whs_visa: "\u0110\xE3 t\u1EEBng c\xF3 WHS visa NZ?",
    sufficient_funds_holiday: "\u0110\u1EE7 ti\u1EC1n cho WHS?",
    travel_date: "Ng\xE0y d\u1EF1 \u0111\u1ECBnh t\u1EDBi NZ",
    been_to_nz: "\u0110\xE3 t\u1EDBi NZ ch\u01B0a?",
    been_to_nz_when: "N\u1EBFu c\xF3, khi n\xE0o?",
    sufficient_funds_onward_ticket: "\u0110\u1EE7 ti\u1EC1n v\xE9 v\u1EC1?",
    meet_scheme_requirements: "\u0110\u1EE7 \u0111i\u1EC1u ki\u1EC7n scheme?"
  };
  var YES_NO = /* @__PURE__ */ new Set([
    "has_agent",
    "has_credit_card",
    "renal_dialysis",
    "active_tb",
    "cancer",
    "heart_disease",
    "disability",
    "hospitalisation",
    "residential_care",
    "pregnancy",
    "tb_risk",
    "imprisonment_5_years",
    "imprisonment_12_months",
    "deported",
    "charged",
    "convicted",
    "under_investigation",
    "excluded",
    "removed",
    "previous_whs_visa",
    "sufficient_funds_holiday",
    "been_to_nz",
    "sufficient_funds_onward_ticket",
    "meet_scheme_requirements"
  ]);
  var SELECTS = {
    title: ["Mr", "Mrs", "Ms", "Miss", "Dr", "Other"],
    gender: ["Male", "Female"],
    communication_method: ["Email"],
    id_type: ["National ID", "Driver Licence", "Birth Certificate", "Other"]
  };
  var data = {};
  var activeSection = "personal";
  var formEl = document.getElementById("dataForm");
  var tabsEl = document.getElementById("tabs");
  var logView = document.getElementById("logView");
  var logMeta = document.getElementById("logMeta");
  var badge = document.getElementById("statusBadge");
  var banner = document.getElementById("captchaBanner");
  var toast = document.getElementById("toast");
  function showToast(text) {
    toast.textContent = text;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 1800);
  }
  var TAB_ORDER = ["personal", "address", "contact", "identification", "occupation", "health", "character", "whs"];
  function ensureDefaults() {
    if (!data.whs || typeof data.whs !== "object") data.whs = { ...DEFAULT_WHS };
    const whs = data.whs;
    for (const [k, v] of Object.entries(DEFAULT_WHS)) {
      if (whs[k] === void 0) whs[k] = v;
    }
  }
  function sections() {
    ensureDefaults();
    const extra = Object.keys(data).filter((k) => typeof data[k] === "object" && !TAB_ORDER.includes(k));
    return [...TAB_ORDER.filter((k) => typeof data[k] === "object"), ...extra];
  }
  function renderTabs() {
    const keys = ["scheme", ...sections()];
    tabsEl.innerHTML = "";
    keys.forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = key === "scheme" ? "Scheme" : LABELS[key] || key;
      btn.className = key === activeSection ? "active" : "";
      btn.onclick = () => {
        collectForm();
        activeSection = key;
        renderTabs();
        renderFields();
      };
      tabsEl.appendChild(btn);
    });
  }
  function fieldControl(key, value) {
    if (YES_NO.has(key)) {
      return `<select data-key="${key}"><option${value === "Yes" ? "" : " selected"}>No</option><option${value === "Yes" ? " selected" : ""}>Yes</option></select>`;
    }
    if (SELECTS[key]) {
      const opts = SELECTS[key].map((v) => `<option${v === value ? " selected" : ""}>${v}</option>`).join("");
      return `<select data-key="${key}">${opts}</select>`;
    }
    if (key.includes("details") || key === "medical_details") {
      return `<textarea data-key="${key}">${value ?? ""}</textarea>`;
    }
    return `<input data-key="${key}" value="${String(value ?? "").replaceAll('"', "&quot;")}">`;
  }
  function renderFields() {
    if (activeSection === "scheme") {
      formEl.innerHTML = `<div class="fields"><div class="wide">
          <label>${LABELS.scheme_country}</label>
          <input data-root="scheme_country" value="${data.scheme_country || ""}">
        </div></div>`;
      return;
    }
    const section = data[activeSection] || {};
    formEl.innerHTML = `<div class="fields">${Object.entries(section).map(
      ([k, v]) => `
        <div class="${k.includes("details") || k === "email" ? "wide" : ""}">
          <label>${LABELS[k] || k}</label>
          ${fieldControl(k, v)}
        </div>`
    ).join("")}</div>`;
  }
  function collectForm() {
    if (activeSection === "scheme") {
      const input = formEl.querySelector("[data-root='scheme_country']");
      if (input) data.scheme_country = input.value;
      return;
    }
    const section = data[activeSection];
    formEl.querySelectorAll("[data-key]").forEach((el) => {
      section[el.dataset.key] = el.value;
    });
  }
  async function loadData() {
    const res = await fetch("/api/data", { cache: "no-store" });
    data = await res.json();
    ensureDefaults();
    activeSection = "whs";
    renderTabs();
    renderFields();
  }
  async function saveData() {
    collectForm();
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    showToast(body.ok ? "\u0110\xE3 l\u01B0u applicant.json" : body.error || "L\u1ED7i l\u01B0u");
  }
  function setStatus(status) {
    const state = status.state || (status.running ? "running" : "idle");
    badge.className = "badge " + state;
    badge.textContent = state.replace("_", " ");
    banner.classList.toggle("show", state === "captcha_paused");
    document.getElementById("runBtn").disabled = !!status.running;
    const file = status.log_file ? status.log_file.split("/").pop() : "";
    logMeta.textContent = [status.step, status.message, file].filter(Boolean).join(" \xB7 ") || "Ch\u01B0a c\xF3 log";
  }
  async function refreshLogs() {
    const res = await fetch("/api/logs");
    const body = await res.json();
    const next = body.text || "Ch\u01B0a c\xF3 log.";
    const atBottom = logView.scrollTop + logView.clientHeight >= logView.scrollHeight - 40;
    logView.textContent = next;
    if (atBottom) logView.scrollTop = logView.scrollHeight;
    setStatus(body.status || {});
  }
  document.getElementById("saveBtn")?.addEventListener("click", () => {
    void saveData();
  });
  document.getElementById("runBtn")?.addEventListener("click", async () => {
    await saveData();
    const res = await fetch("/api/run", { method: "POST" });
    const body = await res.json();
    showToast(body.ok ? "\u0110\xE3 ch\u1EA1y bot" : body.error || "Kh\xF4ng ch\u1EA1y \u0111\u01B0\u1EE3c");
    void refreshLogs();
  });
  document.getElementById("stopBtn")?.addEventListener("click", async () => {
    await fetch("/api/stop", { method: "POST" });
    showToast("\u0110\xE3 g\u1EEDi l\u1EC7nh d\u1EEBng");
    void refreshLogs();
  });
  void loadData();
  void refreshLogs();
  setInterval(() => {
    void refreshLogs();
  }, 1500);
})();
