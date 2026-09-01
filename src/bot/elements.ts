import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { pauseForCaptcha } from "./captcha.ts";
import { type Waiter, waiter, waitReady } from "./driver.ts";
import { log } from "./logger.ts";

export async function clickWhenReady(driver: WebDriver, wait: Waiter, locator: By): Promise<WebElement> {
  const element = (await wait.until(until.elementLocated(locator))) as WebElement;
  await wait.until(until.elementIsVisible(element));
  await wait.until(async () => {
    try {
      return (await element.isDisplayed()) && (await element.isEnabled());
    } catch {
      return false;
    }
  });
  try {
    await element.click();
  } catch {
    await driver.executeScript("arguments[0].click();", element);
  }
  return element;
}

export async function findBySuffix(driver: WebDriver, suffixes: string[], tag = ""): Promise<WebElement> {
  for (const suffix of suffixes) {
    const matches = await driver.findElements(By.css(`${tag}[id$='${suffix}']`));
    if (matches[0]) return matches[0];
  }
  throw new Error(`Field not found: ${suffixes}`);
}

export async function hasSuffix(driver: WebDriver, ...suffixes: string[]): Promise<boolean> {
  for (const suffix of suffixes) {
    if ((await driver.findElements(By.css(`[id$='${suffix}']`))).length) return true;
  }
  return false;
}

export async function pageHasAny(driver: WebDriver, ...locators: By[]): Promise<boolean> {
  try {
    for (const locator of locators) {
      if ((await driver.findElements(locator)).length) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function displayed(elements: WebElement[]): Promise<WebElement | null> {
  const visible: WebElement[] = [];
  for (const el of elements) {
    try {
      if (await el.isDisplayed()) visible.push(el);
    } catch {
      // stale
    }
  }
  return visible.length ? visible[visible.length - 1]! : null;
}

export async function clickable(elements: WebElement[]): Promise<WebElement | null> {
  const hits: WebElement[] = [];
  for (const el of elements) {
    try {
      if ((await el.isDisplayed()) && (await el.isEnabled())) hits.push(el);
    } catch {
      // stale
    }
  }
  return hits.length ? hits[hits.length - 1]! : null;
}

export async function findClickable(driver: WebDriver, locators: By[]): Promise<WebElement | null> {
  for (const locator of locators) {
    const el = await clickable(await driver.findElements(locator));
    if (el) return el;
  }
  return null;
}

export async function dumpUnknownFields(driver: WebDriver, page: string): Promise<void> {
  const ids = (await driver.executeScript(`
    return Array.from(document.querySelectorAll('input, select, textarea'))
      .filter(el => el.type !== 'hidden' && el.id)
      .map(el => el.tagName + '#' + el.id);
  `)) as string[];
  log().info(`UNKNOWN_${page.toUpperCase()}`, `URL=${await driver.getCurrentUrl()} fields=${ids.slice(0, 40)}`);
}

export async function clickAndWaitStale(driver: WebDriver, locator: By, label: string): Promise<void> {
  const wait = waiter(driver);
  await waitReady(driver);
  log().info(label.split(" ")[0] ?? label, label);
  const el = await clickWhenReady(driver, wait, locator);
  await wait.until(until.stalenessOf(el));
  await waitReady(driver);
  await pauseForCaptcha(driver);
}
