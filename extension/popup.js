"use strict";
(() => {
  // extension/src/popup.ts
  async function send(type) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert("H\xE3y m\u1EDF tab onlineservices.immigration.govt.nz r\u1ED3i th\u1EED l\u1EA1i.\n" + message);
    }
  }
  document.getElementById("run")?.addEventListener("click", () => {
    void send("START");
  });
  document.getElementById("stop")?.addEventListener("click", () => {
    void send("STOP");
  });
  document.getElementById("opts")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
})();
