import type { WebDriver, WebElement } from "selenium-webdriver";
import { pauseForCaptcha } from "./captcha.ts";
import { POSTBACK_DETECT_SECONDS, POSTBACK_WAIT_SECONDS } from "./constants.ts";
import { waiter, waitReady } from "./driver.ts";
import { findBySuffix } from "./elements.ts";
import { isWebdriverError } from "./errors.ts";
import { log, withStuck } from "./logger.ts";
import { sleep } from "./time.ts";

export type FillKind = "text" | "select";

export interface FillJob {
  kind: FillKind;
  value: string;
  suffixes: string[];
  optional: boolean;
  tag: string;
}

export interface FillResult {
  ok?: boolean;
  unchanged?: boolean;
  skipped?: boolean;
  suffixes?: string[];
  id?: string;
  value?: string;
  options?: string[];
}

const FILL_JS = `
const jobs = arguments[0];
const results = [];
const findEl = (suffixes, tag) => {
  for (const s of suffixes) {
    const el = document.querySelector((tag || '') + '[id$="' + s + '"]');
    if (el) return el;
  }
  return null;
};
const setText = (el, value) => {
  if (el.value === value) return {ok: true, unchanged: true};
  el.value = value;
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  if (window.jQuery) jQuery(el).val(value).trigger('change');
  return {ok: true, unchanged: false};
};
const setSelect = (el, wanted) => {
  const w = String(wanted).trim();
  const opt = Array.from(el.options || []).find(o => o.text.trim() === w || o.value === w);
  if (!opt) {
    return {ok: false, options: Array.from(el.options).map(o => o.text.trim() + '|' + o.value)};
  }
  if (el.value === opt.value) return {ok: true, unchanged: true, value: opt.value};
  el.value = opt.value;
  if (window.jQuery) {
    const $el = jQuery(el);
    $el.val(opt.value);
    if ($el.data('select2')) $el.select2('val', opt.value);
    $el.trigger('change');
  } else {
    el.dispatchEvent(new Event('change', {bubbles: true}));
  }
  return {ok: true, unchanged: false, value: opt.value};
};
for (const job of jobs) {
  const el = findEl(job.suffixes, job.tag || '');
  if (!el) {
    results.push({ok: !!job.optional, skipped: true, suffixes: job.suffixes});
    continue;
  }
  const r = job.kind === 'select' ? setSelect(el, job.value) : setText(el, job.value);
  r.id = el.id;
  results.push(r);
}
return results;
`;

export function job(kind: FillKind, value: string, suffixes: string[], optional = false): FillJob {
  return { kind, value, suffixes, optional, tag: kind === "select" ? "select" : "" };
}

export async function fillMany(driver: WebDriver, jobs: FillJob[]): Promise<FillResult[]> {
  jobs = jobs.filter((item) => !(item.optional && (item.value === "" || item.value == null)));
  if (!jobs.length) return [];
  const results = (await driver.executeScript(FILL_JS, jobs)) as FillResult[];
  for (let i = 0; i < jobs.length; i += 1) {
    const item = jobs[i]!;
    const result = results[i] ?? {};
    if (result.skipped) {
      if (item.optional) {
        log().info("FILL", `${item.suffixes[0]} (bỏ qua, không bắt buộc)`);
        continue;
      }
      throw new Error(`Field not found: ${item.suffixes}`);
    }
    const name = String(result.id || item.suffixes[0]).split("_").pop();
    const note = result.unchanged ? "đã đúng" : "ghi";
    log().info("FILL", `${name} = ${item.value || "(trống)"} (${note})`);
    if (item.kind === "select" && !result.ok) {
      throw new Error(`Could not select '${item.value}' on ${result.id}: ${JSON.stringify(result)}`);
    }
  }
  return results;
}

export async function setSelect(
  driver: WebDriver,
  wanted: string,
  suffixes: string[],
  optional = false,
): Promise<boolean> {
  if (!wanted && optional) return false;
  const results = await fillMany(driver, [job("select", wanted, suffixes, optional)]);
  return Boolean(results.length) && !results[0]?.unchanged && !results[0]?.skipped;
}

async function inAsyncPostback(driver: WebDriver): Promise<boolean> {
  try {
    return Boolean(
      await driver.executeScript(`
        try {
          return !!(window.Sys && Sys.WebForms && Sys.WebForms.PageRequestManager
            && Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack());
        } catch (e) { return false; }
      `),
    );
  } catch (err) {
    if (isWebdriverError(err)) return false;
    throw err;
  }
}

export async function maybeWaitPostback(driver: WebDriver, element: WebElement): Promise<void> {
  await withStuck("chờ postback", async () => {
    const detectUntil = Date.now() + POSTBACK_DETECT_SECONDS;
    while (Date.now() < detectUntil) {
      try {
        await element.getTagName();
      } catch (err) {
        if (isWebdriverError(err)) {
          await waitReady(driver);
          await pauseForCaptcha(driver);
          return;
        }
        throw err;
      }
      if (await inAsyncPostback(driver)) {
        log().info("WAIT", "ASP.NET postback");
        await waiter(driver, POSTBACK_WAIT_SECONDS).until(async (d: WebDriver) => !(await inAsyncPostback(d)));
        await waitReady(driver);
        await pauseForCaptcha(driver);
        return;
      }
      await sleep(20);
    }
  });
}

export async function setSelectMaybePostback(driver: WebDriver, wanted: string, ...suffixes: string[]): Promise<void> {
  const el = await findBySuffix(driver, suffixes, "select");
  if (await setSelect(driver, wanted, suffixes)) {
    await maybeWaitPostback(driver, el);
  }
}
