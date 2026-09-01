import { By, type WebDriver } from "selenium-webdriver";
import { DECL_CHECKBOX_SUFFIXES } from "./constants.ts";
import { waiter } from "./driver.ts";
import { dumpUnknownFields } from "./elements.ts";
import { log } from "./logger.ts";
import { nowSec } from "./time.ts";

interface DeclResult {
  total?: number;
  checked?: number;
  ids?: string[];
}

export async function fillDeclaration(driver: WebDriver, quiet = false): Promise<void> {
  await waiter(driver).until(async (d: WebDriver) => {
    const boxes = await d.findElements(By.css("input[type='checkbox']"));
    const submits = await d.findElements(By.css("input[value='SUBMIT']"));
    return boxes.length > 0 || submits.length > 0 || (await d.getCurrentUrl()).includes("Submit.aspx");
  });
  const started = nowSec();
  const result = ((await driver.executeScript(
    `
    const suffixes = arguments[0];
    const tick = (el) => {
      if (!el || el.disabled || el.type !== 'checkbox') return false;
      if (el.checked) return true;
      try { el.click(); } catch (e) {}
      if (!el.checked) {
        el.checked = true;
        el.dispatchEvent(new Event('click', {bubbles: true}));
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
        if (window.jQuery) jQuery(el).prop('checked', true).trigger('click').trigger('change');
      }
      if (!el.checked && el.id) {
        const label = document.querySelector('label[for="' + el.id + '"]');
        if (label) { try { label.click(); } catch (e) {} }
      }
      return !!el.checked;
    };
    const seen = new Set();
    const boxes = [];
    const add = (el) => { if (!el || seen.has(el)) return; seen.add(el); boxes.push(el); };
    for (const s of suffixes) {
      document.querySelectorAll('input[type="checkbox"][id$="' + s + '"]').forEach(add);
    }
    document.querySelectorAll('input[type="checkbox"]').forEach(add);
    document.querySelectorAll('label').forEach((label) => {
      if (label.textContent.trim() !== 'Yes') return;
      if (label.htmlFor) add(document.getElementById(label.htmlFor));
      add(label.querySelector('input[type="checkbox"]'));
    });
    const ids = [];
    let checked = 0;
    for (const el of boxes) {
      if (el.disabled) continue;
      if (tick(el)) checked += 1;
      ids.push((el.id || el.name || '') + (el.checked ? ':on' : ':off'));
    }
    return {total: boxes.length, checked, ids};
    `,
    [...DECL_CHECKBOX_SUFFIXES],
  )) ?? {}) as DeclResult;
  if (quiet) return;
  const checked = result.checked ?? 0;
  const total = result.total ?? 0;
  const leftover = (result.ids ?? []).filter((i) => i.endsWith(":off"));
  if (checked === 0) {
    await dumpUnknownFields(driver, "declaration");
    throw new Error("Không tìm thấy checkbox declaration để tick Yes");
  }
  let msg = `Đã tick ${checked}/${total} ô Yes`;
  if (leftover.length) msg += ` — chưa tick: ${leftover}`;
  log().ok("FILL_DECLARATION", msg, nowSec() - started);
  if (leftover.length) log().info("DECLARATION_UNCHECKED", String(leftover));
}
