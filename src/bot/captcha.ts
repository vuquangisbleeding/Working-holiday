import type { WebDriver } from "selenium-webdriver";
import { CAPTCHA_POLL_SECONDS } from "./constants.ts";
import { waitReady } from "./driver.ts";
import { isWebdriverError } from "./errors.ts";
import { log, stats } from "./logger.ts";
import { formatDuration, nowSec, sleep } from "./time.ts";
import axios from "axios";
export async function isCaptcha(driver: WebDriver): Promise<boolean> {
  let url: string;
  try {
    url = (await driver.getCurrentUrl()).toLowerCase();
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
  if (url.includes("rs-captcha") || url.includes("/captcha")) return true;
  try {
    return Boolean(
      await driver.executeScript(`
        const frames = Array.from(document.querySelectorAll('iframe'));
        return frames.some((f) => {
          const src = (f.src || '').toLowerCase();
          const title = (f.title || '').toLowerCase();
          if (getComputedStyle(f).display === 'none' || f.offsetParent === null) return false;
          const challenge = src.includes('bframe') || src.includes('rs-captcha')
            || title.includes('challenge') || title.includes('rs-captcha');
          return challenge && f.offsetWidth > 180 && f.offsetHeight > 180;
        });
      `),
    );
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}

const COLLECT_CAPTCHA_JS = `
  const pageURL = location.href;
  const keyed = document.querySelector('[data-sitekey]');
  let sitekey = keyed ? (keyed.getAttribute('data-sitekey') || '') : '';
  if (!sitekey) {
    for (const f of document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="google.com/recaptcha"]')) {
      try {
        const u = new URL(f.src);
        sitekey = u.searchParams.get('k') || u.searchParams.get('render') || sitekey;
      } catch (e) {}
    }
  }
  const info = { pageURL, sitekey: sitekey || '(không thấy data-sitekey)' };
  console.log('[WHS CAPTCHA] pageURL:', info.pageURL);
  console.log('[WHS CAPTCHA] data-sitekey:', info.sitekey);
  return info;
`;
const CAPSOLVER_API_KEY = "CAP-27799A209BF30CFDD4659F51B1ACE91EDED77C229A0C3E9CD8383B6D54CA3B15";


export async function readCaptchaInfo(driver: WebDriver): Promise<{ pageURL: string; sitekey: string }> {
  try {
    const info = (await driver.executeScript(COLLECT_CAPTCHA_JS)) as { pageURL?: string; sitekey?: string };
    return {
      pageURL: info?.pageURL || (await driver.getCurrentUrl()),
      sitekey: info?.sitekey || "(không thấy data-sitekey)",
    };
  } catch (err) {
    if (isWebdriverError(err)) {
      return { pageURL: "", sitekey: "(lỗi đọc trang)" };
    }
    throw err;
  }
}

export function logCaptchaInfo(info: { pageURL: string; sitekey: string }): void {
  console.log("[WHS CAPTCHA] pageURL:", info.pageURL);
  console.log("[WHS CAPTCHA] data-sitekey:", info.sitekey);
  log().pause("CAPTCHA_INFO", `pageURL=${info.pageURL} | data-sitekey=${info.sitekey}`);
}

export async function recaptchaNeedsUser(driver: WebDriver): Promise<boolean> {
  try {
    return Boolean(
      await driver.executeScript(`
        const widget = document.querySelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"]');
        if (!widget) return false;
        const ta = document.querySelector('#g-recaptcha-response, textarea[name="g-recaptcha-response"]');
        return !(ta && String(ta.value || '').trim().length > 10);
      `),
    );
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}export async function createTask(captchaInfo: { pageURL: string; sitekey: string }): Promise<string> {
  try {
  const result = await axios.post("https://api.capsolver.com/createTask",{
      clientKey: CAPSOLVER_API_KEY,
    task: {
      type: "ReCaptchaV2Task",
      websiteURL: captchaInfo.pageURL,
      websiteKey: captchaInfo.sitekey,
    }
  });
  return result.data.taskId;
  } catch (error) { 
    console.error("[WHS CAPTCHA] Error creating task:", (error as Error).message);
    throw error;
  }
}
export async function pauseForCaptcha(driver: WebDriver): Promise<void> {
  if (!(await isCaptcha(driver))) return;
  const captchaInfo = await readCaptchaInfo(driver);
  const taskId = await createTask(captchaInfo);
  console.log("success create task:", taskId);

  logCaptchaInfo(await readCaptchaInfo(driver));
  const started = nowSec();
  log().pause("CAPTCHA", "Tạm dừng. Hãy giải captcha trên cửa sổ Chrome. Script sẽ tự tiếp tục, không thoát.");
  while (await isCaptcha(driver)) {
    await sleep(CAPTCHA_POLL_SECONDS);
  }
  await waitReady(driver);
  const duration = nowSec() - started;
  stats().add_captcha(duration);
  log().ok(
    "CAPTCHA",
    `Bạn giải captcha trong ${formatDuration(duration)} (lần ${stats().captcha_count}). ` +
      `Tổng captcha: ${formatDuration(stats().captcha_total)}. Tiếp tục tại ${await driver.getCurrentUrl()}`,
    duration,
  );
}
