import { DEFAULT_APPLICANT } from "./default-data";

async function load(): Promise<void> {
  const stored = await chrome.storage.local.get(["applicant", "credentials"]);
  const data = stored.applicant || DEFAULT_APPLICANT;
  const json = document.getElementById("json") as HTMLTextAreaElement;
  const username = document.getElementById("username") as HTMLInputElement;
  const password = document.getElementById("password") as HTMLInputElement;
  json.value = JSON.stringify(data, null, 2);
  username.value = stored.credentials?.username || "";
  password.value = stored.credentials?.password || "";
}

document.getElementById("save")?.addEventListener("click", async () => {
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
    await chrome.storage.local.set({ applicant, credentials });
    msg.textContent = "Đã lưu.";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    msg.textContent = "JSON lỗi: " + message;
  }
});

document.getElementById("restore")?.addEventListener("click", () => {
  const json = document.getElementById("json") as HTMLTextAreaElement;
  const msg = document.getElementById("msg") as HTMLElement;
  json.value = JSON.stringify(DEFAULT_APPLICANT, null, 2);
  msg.textContent = "Đã đưa mặc định lên form. Bấm Lưu để ghi.";
});

void load();
