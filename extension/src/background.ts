import { DEFAULT_APPLICANT } from "./default-data";

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["applicant"]);
  if (!cur.applicant) {
    await chrome.storage.local.set({ applicant: DEFAULT_APPLICANT });
  }
});
