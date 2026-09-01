async function send(type: "START" | "STOP"): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    alert("Hãy mở tab onlineservices.immigration.govt.nz rồi thử lại.\n" + message);
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
