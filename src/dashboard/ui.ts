import { DEFAULT_WHS } from "../types.ts";

const LABELS: Record<string, string> = {
  scheme_country: "Nước scheme",
  personal: "Cá nhân",
  address: "Địa chỉ",
  contact: "Liên hệ",
  identification: "Hộ chiếu / ID",
  health: "Sức khỏe",
  character: "Character",
  occupation: "Nghề nghiệp",
  family_name: "Họ",
  given_name_1: "Tên 1",
  given_name_2: "Tên 2",
  given_name_3: "Tên 3",
  other_names: "Tên khác",
  title: "Danh xưng",
  other_title: "Danh xưng khác",
  gender: "Giới tính",
  date_of_birth: "Ngày sinh",
  country_of_birth: "Nước sinh",
  street_number: "Số nhà",
  street_name: "Tên đường",
  suburb: "Suburb",
  city: "Thành phố",
  province: "Tỉnh / bang",
  postal_code: "Mã bưu điện",
  country: "Quốc gia",
  phone_daytime: "ĐT ban ngày",
  phone_night: "ĐT ban đêm",
  phone_mobile: "ĐT di động",
  fax: "Fax",
  email: "Email",
  has_agent: "Có luật sư di trú?",
  communication_method: "Cách liên lạc",
  has_credit_card: "Có Visa/Mastercard?",
  passport_number: "Số hộ chiếu",
  passport_expiry: "Hộ chiếu hết hạn",
  id_type: "Loại giấy tờ",
  id_issue_date: "Ngày cấp ID",
  id_expiry_date: "Ngày hết hạn ID",
  renal_dialysis: "Chạy thận",
  active_tb: "Lao đang hoạt động",
  cancer: "Ung thư",
  heart_disease: "Tim mạch",
  disability: "Khuyết tật",
  hospitalisation: "Nhập viện",
  residential_care: "Chăm sóc dài hạn",
  pregnancy: "Mang thai",
  tb_risk: "Nguy cơ TB (3 tháng)",
  medical_details: "Chi tiết y tế",
  imprisonment_5_years: "Tù 5 năm+",
  imprisonment_12_months: "Tù 12 tháng+",
  deported: "Bị trục xuất",
  charged: "Bị buộc tội",
  convicted: "Bị kết án",
  under_investigation: "Đang điều tra",
  excluded: "Bị từ chối nhập cảnh",
  removed: "Bị yêu cầu rời nước",
  details: "Chi tiết",
  industry_search: "Ngành (search)",
  occupation_search: "Nghề (search)",
  whs: "Working Holiday",
  previous_whs_visa: "Đã từng có WHS visa NZ?",
  sufficient_funds_holiday: "Đủ tiền cho WHS?",
  travel_date: "Ngày dự định tới NZ",
  been_to_nz: "Đã tới NZ chưa?",
  been_to_nz_when: "Nếu có, khi nào?",
  sufficient_funds_onward_ticket: "Đủ tiền vé về?",
  meet_scheme_requirements: "Đủ điều kiện scheme?",
};

const YES_NO = new Set([
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
  "meet_scheme_requirements",
]);

const SELECTS: Record<string, string[]> = {
  title: ["Mr", "Mrs", "Ms", "Miss", "Dr", "Other"],
  gender: ["Male", "Female"],
  communication_method: ["Email"],
  id_type: ["National ID", "Driver Licence", "Birth Certificate", "Other"],
};

type DataMap = Record<string, unknown>;

let data: DataMap = {};
let activeSection = "personal";

const formEl = document.getElementById("dataForm") as HTMLElement;
const tabsEl = document.getElementById("tabs") as HTMLElement;
const logView = document.getElementById("logView") as HTMLElement;
const logMeta = document.getElementById("logMeta") as HTMLElement;
const badge = document.getElementById("statusBadge") as HTMLElement;
const banner = document.getElementById("captchaBanner") as HTMLElement;
const toast = document.getElementById("toast") as HTMLElement;

function showToast(text: string): void {
  toast.textContent = text;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 1800);
}

const TAB_ORDER = ["personal", "address", "contact", "identification", "occupation", "health", "character", "whs"];

function ensureDefaults(): void {
  if (!data.whs || typeof data.whs !== "object") data.whs = { ...DEFAULT_WHS };
  const whs = data.whs as Record<string, string>;
  for (const [k, v] of Object.entries(DEFAULT_WHS)) {
    if (whs[k] === undefined) whs[k] = v;
  }
}

function sections(): string[] {
  ensureDefaults();
  const extra = Object.keys(data).filter((k) => typeof data[k] === "object" && !TAB_ORDER.includes(k));
  return [...TAB_ORDER.filter((k) => typeof data[k] === "object"), ...extra];
}

function renderTabs(): void {
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

function fieldControl(key: string, value: unknown): string {
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

function renderFields(): void {
  if (activeSection === "scheme") {
    formEl.innerHTML = `<div class="fields"><div class="wide">
          <label>${LABELS.scheme_country}</label>
          <input data-root="scheme_country" value="${data.scheme_country || ""}">
        </div></div>`;
    return;
  }
  const section = (data[activeSection] || {}) as Record<string, unknown>;
  formEl.innerHTML = `<div class="fields">${Object.entries(section)
    .map(
      ([k, v]) => `
        <div class="${k.includes("details") || k === "email" ? "wide" : ""}">
          <label>${LABELS[k] || k}</label>
          ${fieldControl(k, v)}
        </div>`
    )
    .join("")}</div>`;
}

function collectForm(): void {
  if (activeSection === "scheme") {
    const input = formEl.querySelector("[data-root='scheme_country']") as HTMLInputElement | null;
    if (input) data.scheme_country = input.value;
    return;
  }
  const section = data[activeSection] as Record<string, unknown>;
  formEl.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-key]").forEach((el) => {
    section[el.dataset.key as string] = el.value;
  });
}

async function loadData(): Promise<void> {
  const res = await fetch("/api/data", { cache: "no-store" });
  data = (await res.json()) as DataMap;
  ensureDefaults();
  activeSection = "whs";
  renderTabs();
  renderFields();
}

async function saveData(): Promise<void> {
  collectForm();
  const res = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string };
  showToast(body.ok ? "Đã lưu applicant.json" : body.error || "Lỗi lưu");
}

function setStatus(status: { state?: string; running?: boolean; step?: string; message?: string; log_file?: string }): void {
  const state = status.state || (status.running ? "running" : "idle");
  badge.className = "badge " + state;
  badge.textContent = state.replace("_", " ");
  banner.classList.toggle("show", state === "captcha_paused");
  (document.getElementById("runBtn") as HTMLButtonElement).disabled = !!status.running;
  const file = status.log_file ? status.log_file.split("/").pop() : "";
  logMeta.textContent = [status.step, status.message, file].filter(Boolean).join(" · ") || "Chưa có log";
}

async function refreshLogs(): Promise<void> {
  const res = await fetch("/api/logs");
  const body = (await res.json()) as { text?: string; status?: Parameters<typeof setStatus>[0] };
  const next = body.text || "Chưa có log.";
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
  const body = (await res.json()) as { ok?: boolean; error?: string };
  showToast(body.ok ? "Đã chạy bot" : body.error || "Không chạy được");
  void refreshLogs();
});
document.getElementById("stopBtn")?.addEventListener("click", async () => {
  await fetch("/api/stop", { method: "POST" });
  showToast("Đã gửi lệnh dừng");
  void refreshLogs();
});

void loadData();
void refreshLogs();
setInterval(() => {
  void refreshLogs();
}, 1500);
